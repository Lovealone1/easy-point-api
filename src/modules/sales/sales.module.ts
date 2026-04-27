import { Module } from '@nestjs/common';
import { SalesService } from './sales.service.js';
import { SalesController } from './sales.controller.js';
import { SalesRepository } from './sales.repository.js';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module.js';
import { ProductStocksModule } from '../product-stocks/product-stocks.module.js';
import { FinancialTransactionsModule } from '../financial-transactions/financial-transactions.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    ProductStocksModule,         // exports ProductStocksRepository
    InventoryMovementsModule,    // exports InventoryMovementsRepository
    FinancialTransactionsModule, // exports FinancialTransactionsService
  ],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository],
  exports: [SalesService],
})
export class SalesModule {}
