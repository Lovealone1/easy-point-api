import { Module } from '@nestjs/common';
import { SalesService } from './sales.service.js';
import { SalesController } from './sales.controller.js';
import { SalesRepository } from './sales.repository.js';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module.js';
import { ProductStocksModule } from '../product-stocks/product-stocks.module.js';
import { FinancialTransactionsModule } from '../financial-transactions/financial-transactions.module.js';
import { UtilitiesModule } from '../utilities/utilities.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { DiscountRulesModule } from '../discount-rules/discount-rules.module.js';

@Module({
  imports: [
    PrismaModule,
    ProductStocksModule,         // exports ProductStocksRepository
    InventoryMovementsModule,    // exports InventoryMovementsRepository
    FinancialTransactionsModule, // exports FinancialTransactionsService
    UtilitiesModule,             // exports UtilitiesService for atomic utility persistence
    DiscountRulesModule,         // exports DiscountRulesService
  ],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository],
  exports: [SalesService],
})
export class SalesModule {}

