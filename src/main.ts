import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppLogger } from '@/common/logger/app.logger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(new AppLogger());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
