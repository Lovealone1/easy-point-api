import { Inject, Injectable, Logger, ForbiddenException, UnauthorizedException, NotFoundException, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GlobalRole } from '@prisma/client';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../common/config/config.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';
import { GenerateOtpDto } from './dto/generate-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { getOtpEmailTemplate } from '../../infraestructure/mail/templates/otp.template.js';
import { InvitationsService } from '../invitations/invitations.service.js';
import { AuditService } from '../../infraestructure/audit/audit.service.js';
import { AuditAction } from '../../infraestructure/audit/enums/audit-action.enum.js';
import { AuditSeverity } from '../../infraestructure/audit/enums/audit-severity.enum.js';
import crypto from 'crypto';
import * as argon2 from 'argon2';
import { StorageService } from '../../infraestructure/storage/storage.service.js';

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
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
  ) { }

  async generateOtp(payload: GenerateOtpDto, isDevMode: boolean = false) {
    if (isDevMode && this.config.app.env !== 'development') {
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

    // Generate a fresh OTP and hash it with argon2
    const newOtp = this.generateRandomCode();
    const hashedOtp = await argon2.hash(newOtp);

    // Store the hash in Redis (overwriting any previous OTP for this intent/email)
    await this.redisCacheService.set(cacheKey, hashedOtp, this.getOtpTtlSeconds());

    this.logger.log(`Generating new OTP for ${email} (${intent})`);

    if (!isDevMode) {
      await this.sendOtpMail(email, intent, newOtp);
      return { message: 'OTP code sent via email' };
    }

    // In development mode, log the plaintext OTP but do NOT return it to the client
    this.logger.log(`[DEV] OTP code generated locally for ${email}: ${newOtp}`);
    return {
      message: 'OTP code generated locally (Dev)',
    };
  }

  async verifyOtp(payload: VerifyOtpDto) {
    const { email, intent, otp, userInfo, invitationToken } = payload;
    const cacheKey = `otp:${intent}:${email}`;
    const attemptsKey = `otp:verify_attempts:${intent}:${email}`;

    if (intent === 'REGISTER' && !userInfo) {
      throw new BadRequestException('userInfo is required when registering');
    }

    // 0. Check verification attempts
    const attempts = await this.redisCacheService.get<number>(attemptsKey) || 0;
    if (attempts >= 3) {
      this.logger.warn(`OTP verification blocked for ${email} due to max attempts reached`);

      // Audit: login failed due to max attempts
      this.auditService.log({
        action: AuditAction.LOGIN_FAILED,
        resourceType: 'Session',
        metadata: { email, reason: 'MAX_OTP_ATTEMPTS', intent },
        severity: AuditSeverity.CRITICAL,
      });

      throw new ForbiddenException('Maximum verification attempts exceeded. Please request a new code.');
    }

    // 1. Verify OTP in Redis
    const cachedOtpHash = await this.redisCacheService.get<string>(cacheKey);

    if (!cachedOtpHash || !(await argon2.verify(cachedOtpHash, otp))) {
      await this.redisCacheService.incr(attemptsKey, 900); // 15 min lock for attempts
      this.logger.warn(`Invalid or expired OTP attempt for ${email} (${intent}). Attempt: ${attempts + 1}`);

      // Audit: login failed due to invalid OTP
      this.auditService.log({
        action: AuditAction.LOGIN_FAILED,
        resourceType: 'Session',
        metadata: { email, reason: 'INVALID_OTP', intent, attempt: attempts + 1 },
        severity: AuditSeverity.CRITICAL,
      });

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
      if (!user) {
        // Atomic transaction: Create user, and if invitation exists, accept it
        user = await this.prismaService.$transaction(async (tx) => {
          const createdUser = await tx.user.create({
            data: { 
              email,
              firstName: userInfo!.firstName,
              lastName: userInfo!.lastName,
              phoneNumber: userInfo!.phoneNumber,
            },
          });

          if (invitationToken) {
            await this.invitationsService.acceptInvitationInTransaction(
              tx,
              createdUser.id,
              email,
              invitationToken
            );
          }

          return createdUser;
        });
        this.logger.log(`Created new user for ${email}`);
      } else {
        // User already exists. If profile is empty, we can update it.
        // Or if they provided an invitationToken, we can accept it.
        user = await this.prismaService.$transaction(async (tx) => {
          let updatedUser = user!;
          
          if (!updatedUser.firstName && !updatedUser.lastName) {
            updatedUser = await tx.user.update({
              where: { id: updatedUser.id },
              data: {
                firstName: userInfo!.firstName,
                lastName: userInfo!.lastName,
                phoneNumber: userInfo!.phoneNumber,
              }
            });
          }

          if (invitationToken) {
            await this.invitationsService.acceptInvitationInTransaction(
              tx,
              updatedUser.id,
              email,
              invitationToken
            );
          }

          return updatedUser;
        });
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

    // 4. Return partial token (only access token, without metadata). 
    // Stateful tokens are handled in verifyOtpWithMetadata.
    const jwtPayload = {
      sub: user!.id,
      email: user!.email,
    };

    const accessToken = await this.jwtService.signAsync(jwtPayload);
    this.logger.log(`Generated basic access token for ${email}`);

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
    const { accessToken, refreshToken } = await this.generateAuthTokens(user!.id, user!.email, user!.globalRole!, metadata);

    // Audit: successful login
    this.auditService.log({
      action: AuditAction.LOGIN,
      resourceType: 'Session',
      userId: user!.id,
      metadata: {
        email: user!.email,
        intent: payload.intent,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
      severity: AuditSeverity.LOW,
    });

    return {
      ...result,
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshTokenString: string) {
    try {
      const decoded = await this.jwtService.verifyAsync(refreshTokenString, {
        secret: this.config.jwt.refreshSecret,
      });

      // Compute deterministic hash of the provided refresh token
      const tokenHash = crypto.createHash('sha256').update(refreshTokenString).digest('hex');

      // Verify token exists in the database and belongs to the user
      const storedToken = await this.prismaService.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!storedToken || storedToken.userId !== decoded.sub) {
        throw new UnauthorizedException('Invalid or revoked refresh token');
      }

      if (new Date() > storedToken.expiresAt) {
        // Optionally delete the expired token from DB
        await this.prismaService.refreshToken.delete({ where: { id: storedToken.id } }).catch(() => {});
        throw new UnauthorizedException('Refresh token has expired');
      }

      // Verify session exists in Redis and has not been killed/revoked
      if (decoded.sid) {
        const sessionKey = `session_metadata:${decoded.sub}:${decoded.sid}`;
        const isSessionActive = await this.redisCacheService.get(sessionKey);
        if (!isSessionActive) {
          // Clean up the DB token since the session is killed
          await this.prismaService.refreshToken.delete({ where: { id: storedToken.id } }).catch(() => {});
          throw new UnauthorizedException('Session has been revoked or expired');
        }
      }

      const user = storedToken.user;

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User account is invalid or disabled');
      }

      this.logger.log(`Renewing access token for ${user.email}`);
      const tokens = await this.generateAuthTokens(user.id, user.email, user.globalRole!, {
        ip: decoded.ip || 'unknown',
        userAgent: decoded.userAgent || 'unknown'
      });

      // Revoke the old refresh token (Rotation)
      await this.prismaService.refreshToken.delete({ where: { id: storedToken.id } });

      // Revoke old session from Redis during rotation to prevent memory leak and session list pollution
      if (decoded.sid) {
        await Promise.all([
          this.redisCacheService.delete(`session_metadata:${user.id}:${decoded.sid}`),
          this.redisCacheService.srem(`user_sessions:${user.id}`, decoded.sid),
        ]);
      }

      return {
        message: 'Tokens refreshed successfully',
        ...tokens,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }



  async getSessions(userId: string) {
    const sessionIds = await this.redisCacheService.smembers(`user_sessions:${userId}`);
    if (sessionIds.length === 0) return [];

    const keys = sessionIds.map(sid => `session_metadata:${userId}:${sid}`);
    const sessions = await this.redisCacheService.mget<SessionMetadata>(keys);

    // Filter out expired/null sessions and sort by creation
    const expiredSids: string[] = [];
    const activeSessions = sessions.filter((s, index) => {
      if (s === null) {
        expiredSids.push(sessionIds[index]);
        return false;
      }
      return true;
    }) as SessionMetadata[];

    if (expiredSids.length > 0) {
      // Clean up dead session IDs from the user's sessions set in Redis
      await Promise.all(
        expiredSids.map(sid => this.redisCacheService.srem(`user_sessions:${userId}`, sid))
      ).catch(err => this.logger.warn(`Failed to clean expired sessions: ${err.message}`));
    }

    return activeSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async logout(userId: string, sessionId: string, refreshTokenString?: string) {
    // Delete session from Redis
    await Promise.all([
      this.redisCacheService.delete(`session_metadata:${userId}:${sessionId}`),
      this.redisCacheService.srem(`user_sessions:${userId}`, sessionId),
    ]);

    // Delete the refresh token from the DB if it was provided
    if (refreshTokenString) {
      try {
        const tokenHash = crypto.createHash('sha256').update(refreshTokenString).digest('hex');
        await this.prismaService.refreshToken.deleteMany({
          where: { tokenHash, userId }
        });
      } catch (error) {
        this.logger.warn(`Failed to delete refresh token from DB during logout for user ${userId}: ${error.message}`);
      }
    }

    this.logger.log(`Session ${sessionId} logged out for user ${userId}`);

    // Audit: logout
    this.auditService.log({
      action: AuditAction.LOGOUT,
      resourceType: 'Session',
      resourceId: sessionId,
      userId,
      sessionId,
      severity: AuditSeverity.LOW,
    });

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    const sessionIds = await this.redisCacheService.smembers(`user_sessions:${userId}`);
    if (sessionIds.length > 0) {
      const keysToDelete = sessionIds.map(sid => `session_metadata:${userId}:${sid}`);
      keysToDelete.push(`user_sessions:${userId}`);

      await Promise.all(keysToDelete.map(key => this.redisCacheService.delete(key)));
    }

    // Revoke all refresh tokens for this user in DB
    await this.prismaService.refreshToken.deleteMany({
      where: { userId }
    });

    this.logger.log(`User ${userId} logged out from all devices`);

    // Audit: logout all
    this.auditService.log({
      action: AuditAction.LOGOUT,
      resourceType: 'Session',
      userId,
      metadata: { scope: 'ALL_DEVICES', sessionCount: sessionIds?.length ?? 0 },
      severity: AuditSeverity.MEDIUM,
    });

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

    // Audit: session kill
    this.auditService.log({
      action: AuditAction.SESSION_KILL,
      resourceType: 'Session',
      resourceId: sessionIdToKill,
      userId,
      metadata: { killedSessionId: sessionIdToKill },
      severity: AuditSeverity.CRITICAL,
    });

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

    // Set TTL to match the refresh token configuration
    const ttlSeconds = Math.floor(this.config.jwt.refreshExpiresInMs / 1000);
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

    // Store a deterministic hash of the refresh token in the database
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prismaService.refreshToken.create({
      data: {
        tokenHash,
        userId,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ip,
        expiresAt: new Date(expiresAt * 1000), // convert to ms
      }
    });

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

  async getProfile(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        organizations: {
          include: {
            organization: {
              include: {
                config: true,
              },
            },
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Resolve logoUrls to presigned URLs if logoUrl is present
    const organizations = await Promise.all(
      user.organizations.map(async (orgUser) => {
        let logoUrl = orgUser.organization.config?.logoUrl || null;
        if (logoUrl) {
          try {
            logoUrl = await this.storageService.getPresignedUrl(logoUrl);
          } catch (error) {
            this.logger.error(`Failed to generate presigned URL for logo in organization ${orgUser.organization.id}`, error);
          }
        }

        return {
          id: orgUser.organization.id,
          name: orgUser.organization.name,
          slug: orgUser.organization.slug,
          role: orgUser.role.name,
          config: orgUser.organization.config
            ? {
                ...orgUser.organization.config,
                logoUrl,
                // Enrich with organization-level fields that the frontend
                // OrganizationConfig type expects but are not on the config row.
                organizationName: orgUser.organization.name,
                organizationEmail: orgUser.organization.email ?? null,
                plan: orgUser.organization.plan,
                planActiveUntil: orgUser.organization.planActiveUntil ?? null,
                organizationIsActive: orgUser.organization.isActive,
              }
            : null,
        };
      })
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      globalRole: user.globalRole,
      organizations,
    };
  }
}
