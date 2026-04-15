import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JsonBodyMiddleware } from './common/middlewares/json-body.middleware.js';
import { LoggerMiddleware } from './common/middlewares/logger.middleware.js';
import { RateLimitMiddleware } from './common/middlewares/rate-limit.middleware.js';
import { RedisModule } from './infraestructure/redis/redis.module.js';
import appConfig from './common/config/config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig],
    }),
    RedisModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JsonBodyMiddleware, LoggerMiddleware, RateLimitMiddleware)
      .forRoutes('{*path}');
  }
}
