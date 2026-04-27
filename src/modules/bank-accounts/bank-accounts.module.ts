import { Module } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service.js';
import { BankAccountsController } from './bank-accounts.controller.js';
import { BankAccountsRepository } from './bank-accounts.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [BankAccountsController],
  providers: [BankAccountsService, BankAccountsRepository],
  exports: [BankAccountsService, BankAccountsRepository],
})
export class BankAccountsModule {}
