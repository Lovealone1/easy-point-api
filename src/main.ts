import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AppLogger } from './common/logger/app.logger.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedocModule, RedocOptions } from 'nestjs-redoc';
import appConfig from './common/config/config.js';
import { REDIS_CLIENT } from './infraestructure/redis/redis.constants.js';

async function bootstrap() {
  const appLogger = new AppLogger();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  app.useLogger(appLogger);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Easy Point API')
    .setDescription('Core ERP SaaS - API Reference')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Expose Swagger UI for realtime testing
  SwaggerModule.setup('/api/swagger', app, document);

  const redocOptions: RedocOptions = {
    title: 'Easy Point API Docs',
    sortPropsAlphabetically: true,
    hideDownloadButton: true,
    hideHostname: false,
    theme: {
      colors: {
        primary: {
          main: '#32329f'
        }
      }
    }
  };

  // Expose Redoc for detailed static documentation
  await RedocModule.setup('/api/docs', app, document, redocOptions);

  const runtimeConfig = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const redisClient = app.get<Redis>(REDIS_CLIENT);
  const port = runtimeConfig.app.port;
  const appUrl = runtimeConfig.app.apiBaseUrl.replace(/\/api$/, '');

  if (runtimeConfig.redis.enabled) {
    try {
      if (redisClient.status === 'wait') {
        await redisClient.connect();
      } else if (
        redisClient.status !== 'ready' &&
        redisClient.status !== 'connect'
      ) {
        await redisClient.connect();
      }

      appLogger.success(
        `Redis is connected on ${runtimeConfig.redis.host}:${runtimeConfig.redis.port}/${runtimeConfig.redis.db}`,
      );
    } catch (error) {
      const redisError =
        error instanceof Error ? error : new Error(String(error));

      appLogger.error(
        `Failed to connect Redis on ${runtimeConfig.redis.host}:${runtimeConfig.redis.port}/${runtimeConfig.redis.db}: ${redisError.message}`,
        redisError.stack,
      );
      throw redisError;
    }
  } else {
    appLogger.warn('Redis is disabled by configuration');
  }

  await app.listen(port);

  appLogger.success(`🚀 API is successfully running on ${appUrl}/api`);
  appLogger.debug(`📚 Swagger UI available on ${appUrl}/api/swagger`);
  appLogger.debug(`📚 Redoc Documentation available on ${appUrl}/api/docs`);
}

bootstrap();
