import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';
import { InvitationsService } from '../invitations/invitations.service.js';
import { AuditService } from '../../infraestructure/audit/audit.service.js';
import { StorageService } from '../../infraestructure/storage/storage.service.js';
import appConfig from '../../common/config/config.js';
import * as argon2 from 'argon2';
import { AuthIntent } from './enums/auth-intent.enum.js';
import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { GlobalRole, SessionScope } from '@prisma/client';

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
          useValue: {
            app: { env: 'development' },
            jwt: {
              refreshSecret: 'secret',
              refreshExpiresIn: '7d',
              refreshExpiresInMs: 7 * 24 * 60 * 60 * 1000,
              adminRefreshExpiresIn: '8h',
              adminRefreshExpiresInMs: 8 * 60 * 60 * 1000,
            },
          },
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
            $systemTransaction: jest.fn().mockImplementation((cb) => cb(prismaService)),
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
        {
          provide: StorageService,
          useValue: {
            uploadFile: jest.fn(),
            getPresignedUrl: jest.fn(),
            deleteFile: jest.fn(),
          },
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
    it.each(['production', 'development'])('uses the Redis TTL in the rendered %s email', async (env) => {
      (service as any).config.app.env = env;
      redisCacheService.get.mockResolvedValue(null);
      const sendMail = (service as any).mailService.sendMail as jest.Mock;
      sendMail.mockResolvedValue(true);
      await service.generateOtp({ email: 'test@test.com', intent: AuthIntent.LOGIN });
      const ttl = env === 'production' ? 120 : 900;
      expect(redisCacheService.set).toHaveBeenCalledWith('otp:LOGIN:test@test.com', 'hashed-otp', ttl);
      const html = sendMail.mock.calls[0][2];
      expect(html).toContain(`Expires in ${ttl / 60} minutes`);
      expect(html).toMatch(/<p class="code">\d{6}<\/p>/);
      expect(html).toContain('cid:easypoint-logo@easy-point');
      expect(html).not.toContain('${');
    });

    it('does not claim the OTP was sent when SMTP fails', async () => {
      redisCacheService.get.mockResolvedValue(null);
      (service as any).mailService.sendMail.mockRejectedValue(new Error('SMTP unavailable'));
      await expect(service.generateOtp({ email: 'test@test.com', intent: AuthIntent.LOGIN })).rejects.toThrow('SMTP unavailable');
    });

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
    const decodedFor = (scope: SessionScope) => ({
      sub: 'user-1',
      email: 'test@test.com',
      role: 'USER',
      scope,
      sid: 'session-123',
      ip: '127.0.0.1',
      userAgent: 'agent',
    });

    const storedTokenFor = (scope: SessionScope) => ({
      id: 'token-id-123',
      userId: 'user-1',
      scope,
      expiresAt: new Date(Date.now() + 100000),
      user: { id: 'user-1', email: 'test@test.com', isActive: true, globalRole: 'USER' },
    });

    it('should successfully rotate tokens if session is active', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce(decodedFor(SessionScope.TENANT));
      prismaService.refreshToken.findUnique.mockResolvedValueOnce(storedTokenFor(SessionScope.TENANT));

      redisCacheService.get.mockResolvedValueOnce('active-session-metadata');

      jwtService.signAsync.mockResolvedValueOnce('new-access-token');
      jwtService.signAsync.mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshToken('old-refresh-token');

      expect(redisCacheService.get).toHaveBeenCalledWith('session_metadata:TENANT:user-1:session-123');
      expect(prismaService.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'token-id-123' } });
      expect(result.accessToken).toBe('new-access-token');
    });

    it('should throw UnauthorizedException if session is revoked/inactive in Redis', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce(decodedFor(SessionScope.TENANT));
      prismaService.refreshToken.findUnique.mockResolvedValueOnce(storedTokenFor(SessionScope.TENANT));

      redisCacheService.get.mockResolvedValueOnce(null); // Revoked/Inactive session

      await expect(service.refreshToken('old-refresh-token')).rejects.toThrow(UnauthorizedException);
      expect(prismaService.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'token-id-123' } });
    });

    it('refuses a console refresh token presented at the dashboard endpoint', async () => {
      // The claim says ADMIN, the endpoint wants TENANT. Rejected before the
      // stored row is even looked up: a console session must never be
      // exchangeable for a dashboard one.
      jwtService.verifyAsync.mockResolvedValueOnce(decodedFor(SessionScope.ADMIN));

      await expect(
        service.refreshToken('console-refresh-token', SessionScope.TENANT),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaService.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('refuses a token whose claim was scoped but whose stored row was not', async () => {
      // Belt and braces: a claim that says ADMIN still has to match a row that
      // was actually issued for the console.
      jwtService.verifyAsync.mockResolvedValueOnce(decodedFor(SessionScope.ADMIN));
      prismaService.refreshToken.findUnique.mockResolvedValueOnce(storedTokenFor(SessionScope.TENANT));

      await expect(
        service.refreshToken('mismatched-token', SessionScope.ADMIN),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rotates a console session against its own Redis namespace', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce(decodedFor(SessionScope.ADMIN));
      prismaService.refreshToken.findUnique.mockResolvedValueOnce(storedTokenFor(SessionScope.ADMIN));

      redisCacheService.get.mockResolvedValueOnce('active-session-metadata');
      jwtService.signAsync.mockResolvedValueOnce('new-access-token');
      jwtService.signAsync.mockResolvedValueOnce('new-refresh-token');

      await service.refreshToken('old-refresh-token', SessionScope.ADMIN);

      expect(redisCacheService.get).toHaveBeenCalledWith('session_metadata:ADMIN:user-1:session-123');
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

      expect(redisCacheService.srem).toHaveBeenCalledWith('user_sessions:TENANT:user-1', 'session-expired');
      expect(result).toHaveLength(1);
      expect(result[0].sid).toBe('session-active');
    });

    it('lists only the sessions of the application asked about', async () => {
      redisCacheService.smembers.mockResolvedValueOnce([]);

      await service.getSessions('user-1', SessionScope.ADMIN);

      expect(redisCacheService.smembers).toHaveBeenCalledWith('user_sessions:ADMIN:user-1');
    });
  });

  describe('signing out', () => {
    it('leaves the other application untouched', async () => {
      await service.logout('user-1', 'session-123', SessionScope.ADMIN);

      expect(redisCacheService.delete).toHaveBeenCalledWith('session_metadata:ADMIN:user-1:session-123');
      expect(redisCacheService.srem).toHaveBeenCalledWith('user_sessions:ADMIN:user-1', 'session-123');

      // The point of the whole change: nothing addressed to the other
      // application's namespace was touched.
      const touchedKeys = [
        ...redisCacheService.delete.mock.calls.map((c) => String(c[0])),
        ...redisCacheService.srem.mock.calls.map((c) => String(c[0])),
      ];
      expect(touchedKeys.some((key) => key.includes('TENANT'))).toBe(false);
    });

    it('clears both applications on logout-all, because that is what it promises', async () => {
      redisCacheService.smembers.mockResolvedValue(['session-a']);

      await service.logoutAll('user-1');

      const deleted = redisCacheService.delete.mock.calls.map((c) => String(c[0]));
      expect(deleted).toContain('session_metadata:TENANT:user-1:session-a');
      expect(deleted).toContain('session_metadata:ADMIN:user-1:session-a');
      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });

  describe('console sign-in', () => {
    const metadata = { ip: '127.0.0.1', userAgent: 'agent' };

    beforeEach(() => {
      // A valid code: no prior attempts, and a cached hash argon2 accepts.
      redisCacheService.get.mockResolvedValueOnce(0);
      redisCacheService.get.mockResolvedValueOnce('hashed-otp');
    });

    it('refuses to mint a console session for a user who is not a global admin', async () => {
      const user = { id: 'user-1', email: 'test@test.com', isActive: true, globalRole: GlobalRole.USER };
      prismaService.user.findUnique.mockResolvedValue(user);

      await expect(
        service.verifyOtpWithMetadata(
          { email: 'test@test.com', otp: '123456', intent: AuthIntent.ADMIN_LOGIN },
          metadata,
          SessionScope.ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);

      // The decisive part: no session was persisted and no token row written.
      expect(prismaService.refreshToken.create).not.toHaveBeenCalled();
    });

    it('opens a console session for a global admin, in the console namespace', async () => {
      const user = { id: 'admin-1', email: 'admin@test.com', isActive: true, globalRole: GlobalRole.ADMIN };
      prismaService.user.findUnique.mockResolvedValue(user);

      await service.verifyOtpWithMetadata(
        { email: 'admin@test.com', otp: '123456', intent: AuthIntent.ADMIN_LOGIN },
        metadata,
        SessionScope.ADMIN,
      );

      expect(redisCacheService.sadd).toHaveBeenCalledWith('user_sessions:ADMIN:admin-1', expect.any(String));
      expect(prismaService.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ scope: SessionScope.ADMIN }) }),
      );

      // The scope travels in the token, which is what every guard downstream
      // reads instead of trusting a header.
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ scope: SessionScope.ADMIN, sub: 'admin-1' }),
      );
    });
  });

  describe('generateAdminOtp', () => {
    it('sends nothing to an address that is not an active global admin', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce({ id: 'user-1', globalRole: GlobalRole.USER, isActive: true });

      const result = await service.generateAdminOtp('stranger@test.com');

      // Same answer a real admin gets, so the endpoint cannot be used to
      // discover who holds admin rights...
      expect(result).toEqual({ message: 'OTP code sent via email' });
      // ...and no code was ever stored or mailed.
      expect(redisCacheService.set).not.toHaveBeenCalled();
    });

    it('issues a code under the console intent for a global admin', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce({ id: 'admin-1', globalRole: GlobalRole.ADMIN, isActive: true });

      await service.generateAdminOtp('admin@test.com');

      expect(redisCacheService.set).toHaveBeenCalledWith(
        'otp:ADMIN_LOGIN:admin@test.com',
        'hashed-otp',
        expect.any(Number),
      );
    });
  });
});
