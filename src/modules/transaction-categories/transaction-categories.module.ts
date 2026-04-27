import { Module } from '@nestjs/common';
import { TransactionCategoriesService } from './transaction-categories.service.js';
import { TransactionCategoriesController } from './transaction-categories.controller.js';
import { TransactionCategoriesRepository } from './transaction-categories.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [TransactionCategoriesController],
  providers: [TransactionCategoriesService, TransactionCategoriesRepository],
  exports: [TransactionCategoriesService],
})
export class TransactionCategoriesModule {}
