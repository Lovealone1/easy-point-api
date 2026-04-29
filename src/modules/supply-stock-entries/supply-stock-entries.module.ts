import { Module } from '@nestjs/common';
import { SupplyStockEntriesService } from './supply-stock-entries.service.js';
import { SupplyStockEntriesController } from './supply-stock-entries.controller.js';
import { SupplyStockEntriesRepository } from './supply-stock-entries.repository.js';
import { SupplyStocksModule } from '../supply-stocks/supply-stocks.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, SupplyStocksModule],
  controllers: [SupplyStockEntriesController],
  providers: [SupplyStockEntriesService, SupplyStockEntriesRepository],
  exports: [SupplyStockEntriesService, SupplyStockEntriesRepository],
})
export class SupplyStockEntriesModule {}
