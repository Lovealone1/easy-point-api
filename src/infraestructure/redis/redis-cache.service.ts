import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

@Injectable()
export class RedisCacheService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const cachedValue = await this.redisClient.get(key);

    if (cachedValue === null) {
      return null;
    }

    return this.deserialize<T>(cachedValue);
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serializedValue = this.serialize(value);

    if (ttlSeconds && ttlSeconds > 0) {
      await this.redisClient.set(key, serializedValue, 'EX', ttlSeconds);
      return;
    }

    await this.redisClient.set(key, serializedValue);
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
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
}
