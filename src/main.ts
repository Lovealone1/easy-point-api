import { NestFactory } from '@nestjs/core';
import type { ConfigType } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { AppLogger } from './common/logger/app.logger.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedocModule, RedocOptions } from 'nestjs-redoc';
import appConfig from './infraestructure/config/config.js';

async function bootstrap() {
  const appLogger = new AppLogger();
  
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(appLogger);
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Easy Point API')
    .setDescription('Core ERP Multitenant - API Reference')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  
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

  await RedocModule.setup('/api/docs', app, document, redocOptions);

  const runtimeConfig = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const port = runtimeConfig.app.port;
  const appUrl = runtimeConfig.app.apiBaseUrl.replace(/\/api$/, '');

  await app.listen(port);

  appLogger.success(`🚀 API is successfully running on ${appUrl}/api`);
  appLogger.debug(`📚 Redoc Documentation available on ${appUrl}/api/docs`);
}

bootstrap();
