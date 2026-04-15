import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import type { RateLimitTierConfig } from '../config/config.js';
import { REDIS_CLIENT } from '../../infraestructure/redis/redis.constants.js';
import { LimitInfo, RateLimiter } from './rate-limiter.interface.js';

@Injectable()
export class RedisRateLimiterService implements RateLimiter {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
    private readonly config: RateLimitTierConfig,
  ) { }

  async allow(key: string): Promise<{ allowed: boolean; info: LimitInfo }> {
    this.validateConfig();

    const now = Date.now();
    const windowId = Math.floor(now / this.config.windowMs);
    const windowKey = `ratelimit:${key}:${windowId}`;

    const count = await this.redisClient.incr(windowKey);

    if (count === 1) {
      await this.redisClient.pexpire(windowKey, this.config.windowMs);
    }

    const reset = new Date((windowId + 1) * this.config.windowMs);
    const remaining = Math.max(this.config.requestsPerWindow - count, 0);
    const retryAfterMs = Math.max(reset.getTime() - now, 0);

    return {
      allowed: count <= this.config.requestsPerWindow,
      info: {
        limit: this.config.requestsPerWindow,
        remaining,
        reset,
        retryAfterMs,
      },
    };
  }

  private validateConfig(): void {
    if (this.config.requestsPerWindow <= 0) {
      throw new Error('Rate limit requestsPerWindow must be greater than 0');
    }

    if (this.config.windowMs <= 0) {
      throw new Error('Rate limit windowMs must be greater than 0');
    }
  }
}
