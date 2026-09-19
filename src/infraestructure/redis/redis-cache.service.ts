import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../common/config/config.js';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

@Injectable()
export class RedisCacheService {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) { }

  async get<T>(key: string): Promise<T | null> {
    const cachedValue = await this.redisClient.get(key);

    if (cachedValue === null) {
      return null;
    }

    return this.deserialize<T>(cachedValue);
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serializedValue = this.serialize(value);
    const effectiveTtlSeconds = ttlSeconds ?? this.config.redis.ttlSeconds;

    if (effectiveTtlSeconds > 0) {
      await this.redisClient.set(key, serializedValue, 'EX', effectiveTtlSeconds);
      return;
    }

    await this.redisClient.set(key, serializedValue);
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async sadd(key: string, value: string): Promise<void> {
    await this.redisClient.sadd(key, value);
  }

  async srem(key: string, value: string): Promise<void> {
    await this.redisClient.srem(key, value);
  }

  async smembers(key: string): Promise<string[]> {
    return this.redisClient.smembers(key);
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const results = await this.redisClient.mget(...keys);
    return results.map(val => (val ? this.deserialize<T>(val) : null));
  }

  private serialize(value: any): string {
    return JSON.stringify(value);
  }

  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const newValue = await this.redisClient.incr(key);

    // If it's a new key and TTL is provided, set the expiration
    if (newValue === 1 && ttlSeconds && ttlSeconds > 0) {
      await this.redisClient.expire(key, ttlSeconds);
    }

    return newValue;
  }

  /**
   * Gives one back to a counter created by `incr`, without ever creating it.
   *
   * Plain DECR is wrong for refunding a quota: on a missing key Redis creates
   * it at -1 with no expiry, so a refund arriving after the window closed
   * would leave a counter that never expires and reads as "under the limit"
   * forever. DECR does preserve an existing TTL, which is what we want — a
   * refund must not extend the window it belongs to.
   *
   * Returns the new value, or null when there was nothing to give back.
   */
  async decrIfPresent(key: string): Promise<number | null> {
    const current = await this.redisClient.get(key);

    if (current === null) {
      return null;
    }

    const newValue = await this.redisClient.decr(key);

    // Either the counter is spent, or it expired between the read and the
    // write and DECR just recreated it at -1. Deleting covers both: a spent
    // counter carries no information, and the phantom key has no TTL.
    if (newValue <= 0) {
      await this.redisClient.del(key);
      return 0;
    }

    return newValue;
  }
}
