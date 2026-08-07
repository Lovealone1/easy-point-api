import { Module } from '@nestjs/common';
import { CurrenciesService } from './currencies.service.js';
import { CurrenciesController } from './currencies.controller.js';
import { CurrenciesRepository } from './currencies.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [CurrenciesController],
  providers: [CurrenciesService, CurrenciesRepository],
  exports: [CurrenciesService],
})
export class CurrenciesModule {}
