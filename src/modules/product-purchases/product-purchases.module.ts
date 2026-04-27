import { Module } from '@nestjs/common';
import { ProductPurchasesService } from './product-purchases.service.js';
import { ProductPurchasesController } from './product-purchases.controller.js';
import { ProductPurchasesRepository } from './product-purchases.repository.js';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module.js';
import { ProductStocksModule } from '../product-stocks/product-stocks.module.js';
import { FinancialTransactionsModule } from '../financial-transactions/financial-transactions.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    ProductStocksModule,          // exports ProductStocksRepository
    InventoryMovementsModule,     // exports InventoryMovementsRepository
    FinancialTransactionsModule,  // exports FinancialTransactionsService
  ],
  controllers: [ProductPurchasesController],
  providers: [ProductPurchasesService, ProductPurchasesRepository],
  exports: [ProductPurchasesService],
})
export class ProductPurchasesModule {}
