import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SessionScope } from '@prisma/client';
import { SessionsService } from './sessions.service.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../infraestructure/audit/audit.service.js';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function session(sid: string, overrides: Record<string, unknown> = {}) {
  return {
    sid,
    ip: '198.51.100.7',
    userAgent: CHROME,
    createdAt: '2026-09-01T10:00:00.000Z',
    expiresAt: 4102444800,
    ...overrides,
  };
}

describe('SessionsService', () => {
  let service: SessionsService;
  let redis: jest.Mocked<RedisCacheService>;
  let prisma: any;
  let audit: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: RedisCacheService,
          useValue: {
            get: jest.fn(),
            delete: jest.fn(),
            smembers: jest.fn().mockResolvedValue([]),
            srem: jest.fn(),
            mget: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PrismaService,
          useValue: { refreshToken: { deleteMany: jest.fn() } },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(SessionsService);
    redis = module.get(RedisCacheService);
    prisma = module.get(PrismaService);
    audit = module.get(AuditService);
  });

  describe('list', () => {
    it('describes the device behind each session', async () => {
      redis.smembers.mockResolvedValueOnce(['a']);
      redis.mget.mockResolvedValueOnce([session('a')]);

      const [view] = await service.list('user-1', SessionScope.TENANT);

      expect(view.device.label).toBe('Chrome 140 on Windows');
      expect(view.device.type).toBe('desktop');
      // The raw header survives alongside the parse, so support can see what
      // the parser could not.
      expect(view.userAgent).toBe(CHROME);
    });

    it('flags the session making the request, and only that one', async () => {
      redis.smembers.mockResolvedValueOnce(['a', 'b']);
      redis.mget.mockResolvedValueOnce([session('a'), session('b')]);

      const views = await service.list('user-1', SessionScope.TENANT, 'b');

      expect(views.find(v => v.sid === 'b')!.current).toBe(true);
      expect(views.find(v => v.sid === 'a')!.current).toBe(false);
    });

    it('flags nothing as current when the caller did not say which session it is', async () => {
      // The console lists somebody else's sessions. None of them is "this
      // device", and claiming one of them is would be a lie on the screen.
      redis.smembers.mockResolvedValueOnce(['a']);
      redis.mget.mockResolvedValueOnce([session('a')]);

      const [view] = await service.list('user-1', SessionScope.TENANT);

      expect(view.current).toBe(false);
    });

    it('falls back to createdAt for sessions minted before lastSeenAt existed', async () => {
      // The upgrade must not sign anybody out, so old blobs have to render.
      redis.smembers.mockResolvedValueOnce(['a']);
      redis.mget.mockResolvedValueOnce([session('a')]);

      const [view] = await service.list('user-1', SessionScope.TENANT);

      expect(view.lastSeenAt).toBe('2026-09-01T10:00:00.000Z');
    });

    it('orders by last use, not by sign-in', async () => {
      redis.smembers.mockResolvedValueOnce(['old-but-active', 'new-but-idle']);
      redis.mget.mockResolvedValueOnce([
        session('old-but-active', {
          createdAt: '2026-08-01T10:00:00.000Z',
          lastSeenAt: '2026-09-18T10:00:00.000Z',
        }),
        session('new-but-idle', { createdAt: '2026-09-17T10:00:00.000Z' }),
      ]);

      const views = await service.list('user-1', SessionScope.TENANT);

      expect(views.map(v => v.sid)).toEqual(['old-but-active', 'new-but-idle']);
    });

    it('prunes sids whose metadata has expired out of the set', async () => {
      // Redis expires the blob but cannot reach into the set referencing it,
      // so the set accumulates tombstones unless a read clears them.
      redis.smembers.mockResolvedValueOnce(['alive', 'expired']);
      redis.mget.mockResolvedValueOnce([session('alive'), null]);

      const views = await service.list('user-1', SessionScope.TENANT);

      expect(views).toHaveLength(1);
      expect(redis.srem).toHaveBeenCalledWith('user_sessions:TENANT:user-1', 'expired');
    });

    it('reads only the namespace of the application it was asked about', async () => {
      await service.list('user-1', SessionScope.ADMIN);

      expect(redis.smembers).toHaveBeenCalledWith('user_sessions:ADMIN:user-1');
      expect(redis.smembers).not.toHaveBeenCalledWith('user_sessions:TENANT:user-1');
    });
  });

  describe('listAllScopes', () => {
    it('returns both applications, each row saying which it belongs to', async () => {
      redis.smembers.mockResolvedValue(['a']);
      redis.mget
        .mockResolvedValueOnce([session('a', { lastSeenAt: '2026-09-19T09:00:00.000Z' })])
        .mockResolvedValueOnce([session('a', { lastSeenAt: '2026-09-19T08:00:00.000Z' })]);

      const views = await service.listAllScopes('user-1');

      expect(views.map(v => v.scope)).toEqual([SessionScope.ADMIN, SessionScope.TENANT]);
    });
  });

  describe('revoke', () => {
    it('drops both Redis keys and audits who pulled the trigger', async () => {
      redis.get.mockResolvedValueOnce(session('doomed'));

      await service.revoke('user-1', 'doomed', SessionScope.TENANT, 'admin-9');

      expect(redis.delete).toHaveBeenCalledWith('session_metadata:TENANT:user-1:doomed');
      expect(redis.srem).toHaveBeenCalledWith('user_sessions:TENANT:user-1', 'doomed');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-9',
          metadata: expect.objectContaining({
            targetUserId: 'user-1',
            onBehalfOfAnotherUser: true,
          }),
        }),
      );
    });

    it('refuses a session id that is not in the namespace asked about', async () => {
      redis.get.mockResolvedValueOnce(null);

      await expect(
        service.revoke('user-1', 'ghost', SessionScope.TENANT, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(redis.delete).not.toHaveBeenCalled();
    });
  });

  describe('revokeAnyScope', () => {
    it('finds the session in the other application and ends it there', async () => {
      // ADMIN is searched first and misses; the second lookup is the hit, and
      // `revoke` looks it up once more before deleting.
      redis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(session('doomed'))
        .mockResolvedValueOnce(session('doomed'));

      await service.revokeAnyScope('user-1', 'doomed', 'admin-9');

      expect(redis.delete).toHaveBeenCalledWith('session_metadata:TENANT:user-1:doomed');
    });

    it('404s when neither application has it', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.revokeAnyScope('user-1', 'ghost', 'admin-9')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('revokeOthers', () => {
    it('keeps the session making the request and ends the rest', async () => {
      redis.smembers.mockResolvedValueOnce(['keep', 'drop-1', 'drop-2']);

      const result = await service.revokeOthers('user-1', SessionScope.TENANT, 'keep');

      expect(result.revoked).toBe(2);
      const deleted = redis.delete.mock.calls.map(call => String(call[0]));
      expect(deleted).toEqual([
        'session_metadata:TENANT:user-1:drop-1',
        'session_metadata:TENANT:user-1:drop-2',
      ]);
    });

    it('leaves the other application alone', async () => {
      redis.smembers.mockResolvedValueOnce(['keep', 'drop-1']);

      await service.revokeOthers('user-1', SessionScope.TENANT, 'keep');

      const touched = [
        ...redis.delete.mock.calls.map(call => String(call[0])),
        ...redis.srem.mock.calls.map(call => String(call[0])),
      ];
      expect(touched.some(key => key.includes('ADMIN'))).toBe(false);
    });
  });

  describe('revokeAll', () => {
    it('clears both applications and every refresh token', async () => {
      redis.smembers.mockResolvedValue(['a']);

      const count = await service.revokeAll('user-1', 'user-1');

      const deleted = redis.delete.mock.calls.map(call => String(call[0]));
      expect(deleted).toContain('session_metadata:ADMIN:user-1:a');
      expect(deleted).toContain('session_metadata:TENANT:user-1:a');
      // The set itself goes too, not only its members.
      expect(deleted).toContain('user_sessions:ADMIN:user-1');
      expect(deleted).toContain('user_sessions:TENANT:user-1');
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(count).toBe(2);
    });
  });
});
