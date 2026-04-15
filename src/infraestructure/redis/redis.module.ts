import {
  FactoryProvider,
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import appConfig from '../config/config.js';
import { RateLimitersService } from '../ratelimit/rate-limiters.service.js';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisCacheService } from './redis-cache.service.js';

const redisClientProvider: FactoryProvider<Redis> = {
  provide: REDIS_CLIENT,
  inject: [appConfig.KEY],
  useFactory: (config: ConfigType<typeof appConfig>): Redis => {
    const redisConfig = config.redis;

    const options: RedisOptions = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      keyPrefix: `${redisConfig.keyPrefix}:`,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    };

    return new Redis(options);
  },
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    redisClientProvider,
    RedisCacheService,
    RateLimitersService,
  ],
  exports: [REDIS_CLIENT, RedisCacheService, RateLimitersService],
})
export class RedisModule
  implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);
  private readonly redisErrorHandler = (error: Error) => {
    this.logger.error(`Redis connection error: ${error.message}`, error.stack);
  };
  private readonly redisConfig: ConfigType<typeof appConfig>['redis'];

  constructor(
    @Inject(appConfig.KEY)
    config: ConfigType<typeof appConfig>,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {
    this.redisConfig = config.redis;

    this.redisClient.on('ready', () => {
      this.logger.log('Redis connection established');
    });

    this.redisClient.on('end', () => {
      this.logger.warn('Redis connection closed');
    });

    this.redisClient.on('error', this.redisErrorHandler);
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.redisConfig.enabled) {
      return;
    }

    this.redisClient.off('error', this.redisErrorHandler);

    if (this.redisClient.status === 'end') {
      return;
    }

    try {
      await this.redisClient.quit();
      this.logger.log('Redis client disconnected gracefully');
    } catch (error) {
      const redisError = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to gracefully disconnect Redis: ${redisError.message}`,
        redisError.stack,
      );
      this.redisClient.disconnect(false);
    }
  }
}
