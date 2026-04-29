import { Module } from '@nestjs/common';
import { ProductionsService } from './productions.service.js';
import { ProductionsController } from './productions.controller.js';
import { ProductionsRepository } from './productions.repository.js';
import { SupplyStockEntriesModule } from '../supply-stock-entries/supply-stock-entries.module.js';
import { SupplyStocksModule } from '../supply-stocks/supply-stocks.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    SupplyStocksModule,        // exports SupplyStocksRepository
    SupplyStockEntriesModule,  // exports SupplyStockEntriesRepository
  ],
  controllers: [ProductionsController],
  providers: [ProductionsService, ProductionsRepository],
  exports: [ProductionsService],
})
export class ProductionsModule {}
