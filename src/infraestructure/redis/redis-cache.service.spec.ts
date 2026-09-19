import { Test, TestingModule } from '@nestjs/testing';
import { RedisCacheService } from './redis-cache.service.js';
import { REDIS_CLIENT } from './redis.constants.js';
import appConfig from '../../common/config/config.js';

describe('RedisCacheService', () => {
  let service: RedisCacheService;
  let redis: {
    get: jest.Mock;
    decr: jest.Mock;
    del: jest.Mock;
    incr: jest.Mock;
    expire: jest.Mock;
    set: jest.Mock;
    ttl: jest.Mock;
  };

  beforeEach(async () => {
    redis = {
      get: jest.fn(),
      decr: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      set: jest.fn(),
      ttl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisCacheService,
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: appConfig.KEY, useValue: { redis: { ttlSeconds: 60 } } },
      ],
    }).compile();

    service = module.get(RedisCacheService);
  });

  describe('decrIfPresent', () => {
    it('leaves a missing key missing', () => {
      // The whole reason this exists instead of a plain DECR: Redis would
      // create the key at -1 with no expiry, leaving a counter that never
      // ages out and always reads as under its limit.
      redis.get.mockResolvedValue(null);

      return service.decrIfPresent('quota').then((result) => {
        expect(result).toBeNull();
        expect(redis.decr).not.toHaveBeenCalled();
      });
    });

    it('gives one back without touching the expiry', async () => {
      redis.get.mockResolvedValue('3');
      redis.decr.mockResolvedValue(2);

      await expect(service.decrIfPresent('quota')).resolves.toBe(2);
      // DECR preserves the TTL on its own; re-setting it would extend the
      // window the refund belongs to.
      expect(redis.expire).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('drops a counter that reaches zero', async () => {
      redis.get.mockResolvedValue('1');
      redis.decr.mockResolvedValue(0);

      await expect(service.decrIfPresent('quota')).resolves.toBe(0);
      expect(redis.del).toHaveBeenCalledWith('quota');
    });

    it('cleans up a key that expired mid-refund', async () => {
      // The read saw a counter, it expired, and DECR recreated it at -1 with
      // no TTL. Deleting is what keeps that phantom from sticking around.
      redis.get.mockResolvedValue('1');
      redis.decr.mockResolvedValue(-1);

      await expect(service.decrIfPresent('quota')).resolves.toBe(0);
      expect(redis.del).toHaveBeenCalledWith('quota');
    });
  });

  describe('setPreservingTtl', () => {
    it('re-applies the remaining TTL instead of resetting it', async () => {
      // A plain `set` would restart the clock, which for a session blob turns
      // a 30-day session into a perpetual one every time it is touched.
      redis.ttl.mockResolvedValue(1200);

      await expect(service.setPreservingTtl('session', { a: 1 })).resolves.toBe(true);
      expect(redis.set).toHaveBeenCalledWith('session', '{"a":1}', 'EX', 1200);
    });

    it('refuses to resurrect a key that has already expired', async () => {
      // -2 is Redis for "no such key". Writing here would bring a session
      // back from the dead, with no expiry at all.
      redis.ttl.mockResolvedValue(-2);

      await expect(service.setPreservingTtl('session', { a: 1 })).resolves.toBe(false);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('leaves a key with no expiry without one', async () => {
      redis.ttl.mockResolvedValue(-1);

      await expect(service.setPreservingTtl('session', { a: 1 })).resolves.toBe(true);
      expect(redis.set).toHaveBeenCalledWith('session', '{"a":1}');
    });
  });
});
