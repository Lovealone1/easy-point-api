import { Module } from '@nestjs/common';
import { FinancialTransactionsService } from './financial-transactions.service.js';
import { FinancialTransactionsController } from './financial-transactions.controller.js';
import { FinancialTransactionsRepository } from './financial-transactions.repository.js';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, BankAccountsModule],
  controllers: [FinancialTransactionsController],
  providers: [FinancialTransactionsService, FinancialTransactionsRepository],
  exports: [FinancialTransactionsService],
})
export class FinancialTransactionsModule {}
