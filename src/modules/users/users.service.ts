import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, Logger } from '@nestjs/common';
import { UsersRepository } from './users.repository.js';
import { UserEntity } from './domain/user.entity.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { RequestEmailOtpDto } from './dto/request-email-otp.dto.js';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';
import { getOtpEmailTemplate } from '../../infraestructure/mail/templates/otp.template.js';
import { Prisma } from '@prisma/client';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../common/config/config.js';
import crypto from 'crypto';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly redisCacheService: RedisCacheService,
    private readonly mailService: MailService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  async findAll(pageOptionsDto: PageOptionsDto): Promise<PageDto<UserEntity>> {
    const skip = pageOptionsDto.skip;
    const take = pageOptionsDto.limit;

    const orderDirection = pageOptionsDto.order
      ? (pageOptionsDto.order.toLowerCase() as Prisma.SortOrder)
      : 'desc';

    const orderBy: Prisma.UserOrderByWithRelationInput = pageOptionsDto.orderBy
      ? ({ [pageOptionsDto.orderBy]: orderDirection } as Prisma.UserOrderByWithRelationInput)
      : { createdAt: 'desc' };

    const where: Prisma.UserWhereInput = pageOptionsDto.search
      ? {
          OR: [
            { email: { contains: pageOptionsDto.search, mode: 'insensitive' } },
            { firstName: { contains: pageOptionsDto.search, mode: 'insensitive' } },
            { lastName: { contains: pageOptionsDto.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, itemCount] = await this.usersRepository.findManyWithCount({
      skip,
      take,
      orderBy,
      where,
    });

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
    return new PageDto(data, pageMetaDto);
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    await this.findOne(id);
    return this.usersRepository.update(id, dto);
  }

  async updateRole(id: string, dto: UpdateUserRoleDto): Promise<UserEntity> {
    await this.findOne(id);
    return this.usersRepository.update(id, { globalRole: dto.globalRole });
  }

  async remove(id: string): Promise<UserEntity> {
    await this.findOne(id);
    return this.usersRepository.delete(id);
  }

  async requestEmailOtp(id: string, dto: RequestEmailOtpDto): Promise<{ message: string }> {
    const user = await this.findOne(id);
    const { newEmail } = dto;

    if (user.email.toLowerCase() === newEmail.toLowerCase()) {
      throw new BadRequestException('El nuevo correo debe ser diferente al actual');
    }

    // Check if newEmail is already registered
    const existing = await this.usersRepository.findByEmail(newEmail);
    if (existing) {
      throw new ConflictException('El correo electrónico ya se encuentra registrado por otro usuario');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await argon2.hash(otp);

    // Save hashed OTP in Redis with 15 mins expiry
    const cacheKey = `otp:CHANGE_EMAIL:${id}:${newEmail}`;
    await this.redisCacheService.set(cacheKey, hashedOtp, 900);

    const isDev = this.config.app.env !== 'production';
    if (isDev) {
      this.logger.log(`[DEV] OTP code generated locally for email change (user ${id}) to ${newEmail}: ${otp}`);
      return { message: 'OTP code generated locally (Dev)' };
    }

    // Send email to newEmail
    const emailSubject = 'Confirmación de Cambio de Correo - Easy Point';
    const emailHtml = getOtpEmailTemplate(otp, 'CHANGE_EMAIL');
    await this.mailService.sendMail(newEmail, emailSubject, emailHtml);

    return { message: 'Verification OTP sent to new email' };
  }

  async verifyEmailOtp(id: string, dto: VerifyEmailOtpDto): Promise<UserEntity> {
    const user = await this.findOne(id);
    const { newEmail, otp } = dto;

    // Check if newEmail is already registered
    const existing = await this.usersRepository.findByEmail(newEmail);
    if (existing) {
      throw new ConflictException('El correo electrónico ya se encuentra registrado por otro usuario');
    }

    const cacheKey = `otp:CHANGE_EMAIL:${id}:${newEmail}`;
    const cachedHash = await this.redisCacheService.get<string>(cacheKey);

    if (!cachedHash || !(await argon2.verify(cachedHash, otp))) {
      throw new BadRequestException('Código OTP inválido o expirado');
    }

    // OTP verified: delete code
    await this.redisCacheService.delete(cacheKey);

    // Force sign out from all sessions to prevent JWT payload inconsistency
    const sessionIds = await this.redisCacheService.smembers(`user_sessions:${id}`);
    if (sessionIds.length > 0) {
      const keysToDelete = sessionIds.map(sid => `session_metadata:${id}:${sid}`);
      keysToDelete.push(`user_sessions:${id}`);
      await Promise.all(keysToDelete.map(key => this.redisCacheService.delete(key)));
    }
    await this.usersRepository.revokeRefreshTokens(id);

    // Update email in DB
    return this.usersRepository.update(id, { email: newEmail });
  }
}
