import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionScope } from '@prisma/client';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import appConfig from '../config/config.js';

// Reflector reads metadata off the handler and the controller class, so both
// have to be real objects even when neither carries any.
class UndecoratedController {
  handler() {}
}

function contextFor(token = 'a-token'): ExecutionContext {
  const request: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => UndecoratedController.prototype.handler,
    getClass: () => UndecoratedController,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard — session activity', () => {
  const NOW = new Date('2026-09-19T12:00:00.000Z');

  let guard: JwtAuthGuard;
  let redis: jest.Mocked<RedisCacheService>;
  let jwt: jest.Mocked<JwtService>;

  const payload = {
    sub: 'user-1',
    sid: 'session-1',
    scope: SessionScope.TENANT,
    role: 'USER',
  };

  const storedSession = {
    sid: 'session-1',
    ip: '198.51.100.7',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-09-01T10:00:00.000Z',
    expiresAt: 4102444800,
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        Reflector,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn().mockResolvedValue(payload) },
        },
        {
          provide: RedisCacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(storedSession),
            setPreservingTtl: jest.fn().mockResolvedValue(true),
          },
        },
        { provide: appConfig.KEY, useValue: { jwt: { secret: 'secret' } } },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
    redis = module.get(RedisCacheService);
    jwt = module.get(JwtService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('records activity on a session that has not been seen recently', async () => {
    await expect(guard.canActivate(contextFor())).resolves.toBe(true);

    expect(redis.setPreservingTtl).toHaveBeenCalledWith(
      'session_metadata:TENANT:user-1:session-1',
      expect.objectContaining({ lastSeenAt: NOW.toISOString() }),
    );
  });

  it('leaves the rest of the session blob alone when it records activity', async () => {
    await guard.canActivate(contextFor());

    const [, written] = redis.setPreservingTtl.mock.calls[0];
    expect(written).toEqual({ ...storedSession, lastSeenAt: NOW.toISOString() });
  });

  it('does not write on every request', async () => {
    // The whole point of the throttle: this runs on the hot path of every
    // authenticated request, and a "last active" label does not need
    // second-level accuracy.
    redis.get.mockResolvedValue({
      ...storedSession,
      lastSeenAt: new Date(NOW.getTime() - 60_000).toISOString(),
    });

    await guard.canActivate(contextFor());

    expect(redis.setPreservingTtl).not.toHaveBeenCalled();
  });

  it('writes again once the throttle window has passed', async () => {
    redis.get.mockResolvedValue({
      ...storedSession,
      lastSeenAt: new Date(NOW.getTime() - 6 * 60_000).toISOString(),
    });

    await guard.canActivate(contextFor());

    expect(redis.setPreservingTtl).toHaveBeenCalled();
  });

  it('still serves the request when recording activity fails', async () => {
    // A convenience field must never be able to take down authentication.
    redis.setPreservingTtl.mockRejectedValue(new Error('redis is having a day'));

    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
  });

  it('rejects a revoked session before recording anything', async () => {
    redis.get.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redis.setPreservingTtl).not.toHaveBeenCalled();
  });

  it('rejects a token minted before the dashboard and console were split', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', sid: 'session-1' });

    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redis.get).not.toHaveBeenCalled();
  });
});
