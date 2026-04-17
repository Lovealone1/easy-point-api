import { Inject, Injectable, Logger, ForbiddenException, UnauthorizedException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GlobalRole } from '@prisma/client';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../common/config/config.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';
import { GenerateOtpDto } from './dto/generate-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { CompleteRegistrationDto } from './dto/complete-registration.dto.js';
import { getOtpEmailTemplate } from '../../infraestructure/mail/templates/otp.template.js';
import { InvitationsService } from '../invitations/invitations.service.js';
import crypto from 'crypto';

export interface SessionMetadata {
  sid: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Dynamic cooldown based on environment
  private getOtpTtlSeconds(): number {
    return this.config.app.env === 'production' ? 120 : 900;
  }

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly redisCacheService: RedisCacheService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
    private readonly invitationsService: InvitationsService,
  ) { }

  async generateOtp(payload: GenerateOtpDto, isDevReturn: boolean = false) {
    if (isDevReturn && this.config.app.env !== 'development') {
      throw new ForbiddenException('Development endpoint is not allowed in this environment');
    }

    const { email, intent } = payload;

    // PRODUCTION SECURITY: Cooldown and Hourly Limits
    if (this.config.app.env === 'production') {
      const cooldownKey = `otp:cooldown:${email}`;
      const hourlyKey = `otp:hourly_count:${email}`;

      const [hasCooldown, hourlyRequests] = await Promise.all([
        this.redisCacheService.get<string>(cooldownKey),
        this.redisCacheService.get<number>(hourlyKey),
      ]);

      if (hasCooldown) {
        throw new HttpException('Please wait 60 seconds before requesting a new code', HttpStatus.TOO_MANY_REQUESTS);
      }

      if (hourlyRequests && hourlyRequests >= 3) {
        throw new HttpException('Maximum OTP requests per hour exceeded', HttpStatus.TOO_MANY_REQUESTS);
      }

      // Set cooldown and increment hourly count
      await Promise.all([
        this.redisCacheService.set(cooldownKey, 'locked', 60),
        this.redisCacheService.incr(hourlyKey, 3600),
      ]);
    }
    const cacheKey = `otp:${intent}:${email}`;

    const existingOtp = await this.redisCacheService.get<string>(cacheKey);

    if (existingOtp) {
      this.logger.log(`Sending existing OTP for ${email} (${intent})`);

      if (!isDevReturn) {
        await this.sendOtpMail(email, intent, existingOtp);
        return { message: 'OTP code sent via email' };
      }

      return {
        message: 'OTP code generated locally (Dev)',
        otp: existingOtp,
      };
    }

    const newOtp = this.generateRandomCode();

    await this.redisCacheService.set(cacheKey, newOtp, this.getOtpTtlSeconds());

    this.logger.log(`Generating new OTP for ${email} (${intent}): ${newOtp}`);

    if (!isDevReturn) {
      await this.sendOtpMail(email, intent, newOtp);
      return { message: 'OTP code sent via email' };
    }

    return {
      message: 'OTP code generated locally (Dev)',
      otp: newOtp,
    };
  }

  async verifyOtp(payload: VerifyOtpDto) {
    const { email, intent, otp } = payload;
    const cacheKey = `otp:${intent}:${email}`;
    const attemptsKey = `otp:verify_attempts:${intent}:${email}`;

    // 0. Check verification attempts
    const attempts = await this.redisCacheService.get<number>(attemptsKey) || 0;
    if (attempts >= 3) {
      this.logger.warn(`OTP verification blocked for ${email} due to max attempts reached`);
      throw new ForbiddenException('Maximum verification attempts exceeded. Please request a new code.');
    }

    // 1. Verify OTP in Redis
    const cachedOtp = await this.redisCacheService.get<string>(cacheKey);

    if (!cachedOtp || cachedOtp !== otp) {
      await this.redisCacheService.incr(attemptsKey, 900); // 15 min lock for attempts
      this.logger.warn(`Invalid or expired OTP attempt for ${email} (${intent}). Attempt: ${attempts + 1}`);
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    // 2. Consume OTP and reset attempts
    await Promise.all([
      this.redisCacheService.delete(cacheKey),
      this.redisCacheService.delete(attemptsKey),
    ]);

    // 3. Database operations (Prisma)
    let user = await this.prismaService.user.findUnique({
      where: { email },
    });

    if (intent === 'LOGIN') {
      if (!user) {
        throw new UnauthorizedException('User not found. Please register first.');
      }
    } else if (intent === 'REGISTER') {
      // Passive registration: if user exists proceed normally, if not create!
      if (!user) {
        user = await this.prismaService.user.create({
          data: { email },
        });
        this.logger.log(`Created new user for ${email}`);
      }
    }

    if (!user!.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Update lastLoginAt if validation is successful
    await this.prismaService.user.update({
      where: { id: user!.id },
      data: { lastLoginAt: new Date() },
    });

    // 4. Generate Access Token JWT
    const jwtPayload = {
      sub: user!.id,
      email: user!.email,
    };

    const accessToken = await this.jwtService.signAsync(jwtPayload);
    this.logger.log(`Generated access token for ${email}`);

    return {
      message: 'OTP verified successfully',
      accessToken,
      user: {
        id: user!.id,
        email: user!.email,
      }
    };
  }

  async verifyOtpWithMetadata(payload: VerifyOtpDto, metadata: { ip: string; userAgent: string }) {
    const result = await this.verifyOtp(payload);

    // In verifyOtp we currently only return accessToken (stateless).
    // We need to replace that with the stateful token generation.
    const user = await this.prismaService.user.findUnique({ where: { email: payload.email } });
    const { accessToken } = await this.generateAuthTokens(user!.id, user!.email, user!.globalRole!, metadata);

    return {
      ...result,
      accessToken,
    };
  }

  async refreshToken(payload: RefreshTokenDto) {
    try {
      const decoded = await this.jwtService.verifyAsync(payload.refreshToken, {
        secret: this.config.jwt.refreshSecret,
      });

      const user = await this.prismaService.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User account is invalid or disabled');
      }

      this.logger.log(`Renewing access token for ${user.email}`);
      const tokens = await this.generateAuthTokens(user.id, user.email, user.globalRole!, {
        ip: decoded.ip || 'unknown',
        userAgent: decoded.userAgent || 'unknown'
      });

      return {
        message: 'Tokens refreshed successfully',
        ...tokens,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async completeRegistration(
    userId: string | null,
    authenticatedEmail: string,
    payload: CompleteRegistrationDto,
  ) {
    // ── FLOW A: Invitation bypass (new user, sub === null) ──────────────────
    if (userId === null) {
      if (!payload.invitationToken) {
        throw new ForbiddenException(
          'invitationToken is required when registering via an invitation',
        );
      }

      const newUser = await this.prismaService.$transaction(async (tx) => {
        // 1. Create user
        const created = await tx.user.create({
          data: {
            email: authenticatedEmail,
            firstName: payload.firstName,
            lastName: payload.lastName,
            phoneNumber: payload.phoneNumber,
          },
        });

        // 2. Link to org + mark invitation ACCEPTED (within same tx)
        await this.invitationsService.acceptInvitationInTransaction(
          tx,
          created.id,
          authenticatedEmail,
          payload.invitationToken!,
        );

        return created;
      });

      // 3. Issue a session token — only accessToken is returned for the invite flow
      const { accessToken } = await this.generateAuthTokens(
        newUser.id,
        newUser.email,
        newUser.globalRole,
        { ip: 'invite-registration', userAgent: 'invite-registration' },
      );

      this.logger.log(
        `[INVITE REGISTER] User ${newUser.email} completed invite-registration`,
      );

      return {
        message: 'Registration completed successfully via invitation',
        accessToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          phoneNumber: newUser.phoneNumber,
        },
      };
    }

    // ── FLOW B: Normal OTP-authenticated user ───────────────────────────────
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('Authenticated user references an orphaned account');
    }

    if (user.firstName || user.lastName) {
      throw new ForbiddenException('User profile is already completed');
    }

    // Verify that the email provided in the body matches the authenticated user
    if (payload.email && payload.email.toLowerCase() !== authenticatedEmail.toLowerCase()) {
      throw new ForbiddenException('The provided email does not match the authenticated user email');
    }

    const updatedUser = await this.prismaService.user.update({
      where: { id: userId },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        phoneNumber: payload.phoneNumber,
      },
    });

    this.logger.log(
      `User ${user.email} completed registration as ${payload.firstName} ${payload.lastName}`,
    );

    return {
      message: 'Registration completed successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phoneNumber: updatedUser.phoneNumber,
      },
    };
  }

  async getSessions(userId: string) {
    const sessionIds = await this.redisCacheService.smembers(`user_sessions:${userId}`);
    if (sessionIds.length === 0) return [];

    const keys = sessionIds.map(sid => `session_metadata:${userId}:${sid}`);
    const sessions = await this.redisCacheService.mget<SessionMetadata>(keys);

    // Filter out expired/null sessions and sort by creation
    return sessions
      .filter((s): s is SessionMetadata => s !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async logout(userId: string, sessionId: string) {
    await Promise.all([
      this.redisCacheService.delete(`session_metadata:${userId}:${sessionId}`),
      this.redisCacheService.srem(`user_sessions:${userId}`, sessionId),
    ]);
    this.logger.log(`Session ${sessionId} logged out for user ${userId}`);
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    const sessionIds = await this.redisCacheService.smembers(`user_sessions:${userId}`);
    if (sessionIds.length > 0) {
      const keysToDelete = sessionIds.map(sid => `session_metadata:${userId}:${sid}`);
      keysToDelete.push(`user_sessions:${userId}`);

      await Promise.all(keysToDelete.map(key => this.redisCacheService.delete(key)));
    }

    this.logger.log(`User ${userId} logged out from all devices`);
    return { message: 'Logged out from all devices successfully' };
  }

  async killSession(userId: string, sessionIdToKill: string) {
    const sessionKey = `session_metadata:${userId}:${sessionIdToKill}`;
    const exists = await this.redisCacheService.get(sessionKey);

    if (!exists) {
      throw new NotFoundException(`Session with ID ${sessionIdToKill} not found`);
    }

    await Promise.all([
      this.redisCacheService.delete(sessionKey),
      this.redisCacheService.srem(`user_sessions:${userId}`, sessionIdToKill),
    ]);
    this.logger.log(`Session ${sessionIdToKill} killed by user ${userId}`);
    return { message: 'Session terminated successfully' };
  }

  private async generateAuthTokens(userId: string, email: string, role: GlobalRole, metadata: { ip: string; userAgent: string }) {
    const sid = crypto.randomUUID();
    const jwtPayload = {
      sub: userId,
      email,
      role,
      sid,
      ip: metadata.ip,
      userAgent: metadata.userAgent
    };

    // Set TTL to 7 days (matching refresh token)
    const ttlSeconds = 7 * 24 * 60 * 60;
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

    const sessionData: SessionMetadata = {
      sid,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      createdAt: new Date().toISOString(),
      expiresAt
    };

    // Persist session to Redis
    await Promise.all([
      this.redisCacheService.set(`session_metadata:${userId}:${sid}`, sessionData, ttlSeconds),
      this.redisCacheService.sadd(`user_sessions:${userId}`, sid),
    ]);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(jwtPayload),
      this.jwtService.signAsync(jwtPayload, {
        secret: this.config.jwt.refreshSecret,
        expiresIn: this.config.jwt.refreshExpiresIn as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private generateRandomCode(length: number = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return crypto.randomInt(min, max).toString();
  }

  private async sendOtpMail(email: string, intent: string, otp: string) {
    const subject = intent === 'LOGIN' ? 'Access Code - Easy Point' : 'Verify your registration on Easy Point';
    const html = getOtpEmailTemplate(otp, intent);

    return this.mailService.sendMail(email, subject, html);
  }
}
