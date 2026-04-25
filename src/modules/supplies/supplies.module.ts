import { Module } from '@nestjs/common';
import { SuppliesService } from './supplies.service.js';
import { SuppliesController } from './supplies.controller.js';
import { SuppliesRepository } from './supplies.repository.js';
import { SupplyStocksModule } from '../supply-stocks/supply-stocks.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, SupplyStocksModule],
  controllers: [SuppliesController],
  providers: [SuppliesService, SuppliesRepository],
  exports: [SuppliesService, SuppliesRepository],
})
export class SuppliesModule {}
