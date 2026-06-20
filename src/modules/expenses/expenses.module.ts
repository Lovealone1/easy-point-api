import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service.js';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesRepository } from './expenses.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { FinancialTransactionsModule } from '../financial-transactions/financial-transactions.module.js';

@Module({
  imports: [PrismaModule, FinancialTransactionsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesRepository],
  exports: [ExpensesService, ExpensesRepository],
})
export class ExpensesModule {}
