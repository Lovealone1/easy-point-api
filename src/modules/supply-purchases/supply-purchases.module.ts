import { Module } from '@nestjs/common';
import { SupplyPurchasesService } from './supply-purchases.service.js';
import { SupplyPurchasesController } from './supply-purchases.controller.js';
import { SupplyPurchasesRepository } from './supply-purchases.repository.js';
import { SupplyMovementsModule } from '../supply-movements/supply-movements.module.js';
import { SupplyStocksModule } from '../supply-stocks/supply-stocks.module.js';
import { SupplyStockEntriesModule } from '../supply-stock-entries/supply-stock-entries.module.js';
import { FinancialTransactionsModule } from '../financial-transactions/financial-transactions.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    SupplyStocksModule,      // exports SupplyStocksRepository
    SupplyStockEntriesModule,// exports SupplyStockEntriesRepository
    SupplyMovementsModule,   // exports SupplyMovementsService + SupplyMovementsRepository
    FinancialTransactionsModule, // exports FinancialTransactionsService
  ],
  controllers: [SupplyPurchasesController],
  providers: [SupplyPurchasesService, SupplyPurchasesRepository],
  exports: [SupplyPurchasesService],
})
export class SupplyPurchasesModule {}
