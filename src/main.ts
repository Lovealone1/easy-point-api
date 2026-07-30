import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AppLogger } from './common/logger/app.logger.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { RedocOptions } from 'nestjs-redoc';
import appConfig from './common/config/config.js';
import { REDIS_CLIENT } from './infraestructure/redis/redis.constants.js';

async function bootstrap() {
  const appLogger = new AppLogger();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  app.useLogger(appLogger);
  app.enableShutdownHooks();

  const runtimeConfig = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  // Behind Caddy/Nginx: trust the configured proxy hop(s) so req.ip and
  // x-forwarded-for based logic (rate limiting, audit logs) see the real client IP.
  app.set('trust proxy', runtimeConfig.app.trustProxy);

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(helmet());
  app.use(cookieParser());
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

  const allowedOrigins = runtimeConfig.cors.origins;
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header (curl, server-to-server, native apps)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  if (runtimeConfig.swagger.enabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Easy Point API')
      .setDescription('Core ERP SaaS - API Reference')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addApiKey(
        { type: 'apiKey', in: 'header', name: 'x-organization-id' },
        'x-organization-id',
      )
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

    // Expose Redoc for detailed static documentation.
    // Imported dynamically because `nestjs-redoc` is a devDependency: it pulls
    // react/react-dom/chart.js (~20MB) that have no place in the production
    // image, where the docs are disabled anyway. Swagger UI above is unaffected.
    try {
      const { RedocModule } = await import('nestjs-redoc');
      await RedocModule.setup('/api/docs', app, document, redocOptions);
    } catch {
      appLogger.warn(
        'ReDoc is not available in this build (nestjs-redoc not installed); Swagger UI is still served',
      );
    }
  } else {
    appLogger.warn('Swagger/ReDoc are disabled (SWAGGER_ENABLED=false)');
  }

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

  await app.listen(port, '0.0.0.0');

  appLogger.success(`🚀 API is successfully running on ${appUrl}/api`);
  if (runtimeConfig.swagger.enabled) {
    appLogger.debug(`📚 Swagger UI available on ${appUrl}/api/swagger`);
    appLogger.debug(`📚 Redoc Documentation available on ${appUrl}/api/docs`);
  }
}

bootstrap();
