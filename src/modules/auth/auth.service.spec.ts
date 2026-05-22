import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';
import { InvitationsService } from '../invitations/invitations.service.js';
import { AuditService } from '../../infraestructure/audit/audit.service.js';
import appConfig from '../../common/config/config.js';
import * as argon2 from 'argon2';
import { AuthIntent } from './enums/auth-intent.enum.js';
import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-otp'),
  verify: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  let service: AuthService;
  let redisCacheService: jest.Mocked<RedisCacheService>;
  let prismaService: any;
  let jwtService: jest.Mocked<JwtService>;
  let invitationsService: jest.Mocked<InvitationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: appConfig.KEY,
          useValue: { app: { env: 'development' }, jwt: { refreshSecret: 'secret', refreshExpiresIn: '7d' } },
        },
        {
          provide: RedisCacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            incr: jest.fn(),
            smembers: jest.fn(),
            sadd: jest.fn(),
            srem: jest.fn(),
            mget: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: { sendMail: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('jwt-token'), verifyAsync: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
            refreshToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
            $transaction: jest.fn().mockImplementation((cb) => cb(prismaService)),
          },
        },
        {
          provide: InvitationsService,
          useValue: { acceptInvitationInTransaction: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    redisCacheService = module.get(RedisCacheService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    invitationsService = module.get(InvitationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateOtp', () => {
    it('should generate, hash and store OTP in redis', async () => {
      redisCacheService.get.mockResolvedValueOnce(null); // No cooldown
      await service.generateOtp({ email: 'test@test.com', intent: AuthIntent.LOGIN }, true);
      
      expect(argon2.hash).toHaveBeenCalled();
      expect(redisCacheService.set).toHaveBeenCalledWith(
        'otp:LOGIN:test@test.com',
        'hashed-otp',
        900,
      );
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP and return tokens for existing user', async () => {
      redisCacheService.get.mockResolvedValueOnce(0); // attempts
      redisCacheService.get.mockResolvedValueOnce('hashed-otp'); // cached otp

      prismaService.user.findUnique.mockResolvedValueOnce({ id: '1', email: 'test@test.com', isActive: true });
      jwtService.signAsync.mockResolvedValue('access-token');

      const result = await service.verifyOtp({ email: 'test@test.com', intent: AuthIntent.LOGIN, otp: '123456' });

      expect(argon2.verify).toHaveBeenCalledWith('hashed-otp', '123456');
      expect(result.accessToken).toBe('access-token');
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('should fail registration without userInfo', async () => {
      await expect(service.verifyOtp({ email: 'test@test.com', intent: AuthIntent.REGISTER, otp: '123456' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should register new user and accept invitation if token provided', async () => {
      redisCacheService.get.mockResolvedValueOnce(0); // attempts
      redisCacheService.get.mockResolvedValueOnce('hashed-otp'); // cached otp
      prismaService.user.findUnique.mockResolvedValueOnce(null); // new user
      
      const createdUser = { id: 'new-id', email: 'test@test.com', isActive: true };
      prismaService.user.create.mockResolvedValueOnce(createdUser);

      const userInfo = { firstName: 'John', lastName: 'Doe', phoneNumber: '123456789' };
      await service.verifyOtp({ 
        email: 'test@test.com', 
        intent: AuthIntent.REGISTER, 
        otp: '123456',
        userInfo,
        invitationToken: 'invite-123'
      });

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: { email: 'test@test.com', ...userInfo }
      });
      expect(invitationsService.acceptInvitationInTransaction).toHaveBeenCalledWith(
        prismaService,
        'new-id',
        'test@test.com',
        'invite-123'
      );
    });
  });

  describe('refreshToken', () => {
    it('should successfully rotate tokens if session is active', async () => {
      const decodedPayload = { sub: 'user-1', email: 'test@test.com', role: 'USER', sid: 'session-123', ip: '127.0.0.1', userAgent: 'agent' };
      jwtService.verifyAsync.mockResolvedValueOnce(decodedPayload);
      
      prismaService.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'token-id-123',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'user-1', email: 'test@test.com', isActive: true, globalRole: 'USER' }
      });

      redisCacheService.get.mockResolvedValueOnce('active-session-metadata');
      
      jwtService.signAsync.mockResolvedValueOnce('new-access-token');
      jwtService.signAsync.mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshToken('old-refresh-token');

      expect(redisCacheService.get).toHaveBeenCalledWith('session_metadata:user-1:session-123');
      expect(prismaService.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'token-id-123' } });
      expect(result.accessToken).toBe('new-access-token');
    });

    it('should throw UnauthorizedException if session is revoked/inactive in Redis', async () => {
      const decodedPayload = { sub: 'user-1', email: 'test@test.com', role: 'USER', sid: 'session-123', ip: '127.0.0.1', userAgent: 'agent' };
      jwtService.verifyAsync.mockResolvedValueOnce(decodedPayload);
      
      prismaService.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'token-id-123',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'user-1', email: 'test@test.com', isActive: true, globalRole: 'USER' }
      });

      redisCacheService.get.mockResolvedValueOnce(null); // Revoked/Inactive session

      await expect(service.refreshToken('old-refresh-token')).rejects.toThrow(UnauthorizedException);
      expect(prismaService.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'token-id-123' } });
    });
  });

  describe('getSessions', () => {
    it('should return active sessions and clean up expired ones', async () => {
      redisCacheService.smembers.mockResolvedValueOnce(['session-active', 'session-expired']);
      redisCacheService.mget.mockResolvedValueOnce([
        { sid: 'session-active', createdAt: '2026-05-20T10:00:00Z', expiresAt: 9999999 },
        null // Expired session
      ]);

      const result = await service.getSessions('user-1');

      expect(redisCacheService.srem).toHaveBeenCalledWith('user_sessions:user-1', 'session-expired');
      expect(result).toHaveLength(1);
      expect(result[0].sid).toBe('session-active');
    });
  });
});
