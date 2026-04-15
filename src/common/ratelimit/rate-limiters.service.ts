import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import appConfig from '../config/config.js';
import { REDIS_CLIENT } from '../../infraestructure/redis/redis.constants.js';
import type { RateLimiters } from './rate-limiters.types.js';
import { RedisRateLimiterService } from './redis-rate-limiter.service.js';

@Injectable()
export class RateLimitersService {
  readonly limiters: RateLimiters;

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {
    this.limiters = this.buildRateLimiters();
  }

  get global() {
    return this.limiters.global;
  }

  get strictIp() {
    return this.limiters.strictIp;
  }

  get moderateIp() {
    return this.limiters.moderateIp;
  }

  get readOps() {
    return this.limiters.readOps;
  }

  get writeOps() {
    return this.limiters.writeOps;
  }

  private buildRateLimiters(): RateLimiters {
    if (!this.config.rateLimit.enabled || !this.config.redis.enabled) {
      return {
        global: null,
        strictIp: null,
        moderateIp: null,
        readOps: null,
        writeOps: null,
      };
    }

    return {
      global: new RedisRateLimiterService(
        this.redisClient,
        this.config.rateLimit.global,
      ),
      strictIp: new RedisRateLimiterService(
        this.redisClient,
        this.config.rateLimit.strictIp,
      ),
      moderateIp: new RedisRateLimiterService(
        this.redisClient,
        this.config.rateLimit.moderateIp,
      ),
      readOps: new RedisRateLimiterService(
        this.redisClient,
        this.config.rateLimit.readOps,
      ),
      writeOps: new RedisRateLimiterService(
        this.redisClient,
        this.config.rateLimit.writeOps,
      ),
    };
  }
}
