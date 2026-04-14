import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppLogger } from './common/logger/app.logger.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedocModule, RedocOptions } from 'nestjs-redoc';

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

  const config = new DocumentBuilder()
    .setTitle('Easy Point API')
    .setDescription('Core ERP Multitenant - API Reference')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
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

  const port = process.env.PORT || 3000;
  const appUrl = process.env.APP_URL || `http://localhost:${port}`;

  await app.listen(port);

  appLogger.success(`🚀 API is successfully running on ${appUrl}/api`);
  appLogger.debug(`📚 Redoc Documentation available on ${appUrl}/api/docs`);
}

bootstrap();
