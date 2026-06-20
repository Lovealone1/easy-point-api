import { Module } from '@nestjs/common';
import { ExpenseCategoriesService } from './expense-categories.service.js';
import { ExpenseCategoriesController } from './expense-categories.controller.js';
import { ExpenseCategoriesRepository } from './expense-categories.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ExpenseCategoriesController],
  providers: [ExpenseCategoriesService, ExpenseCategoriesRepository],
  exports: [ExpenseCategoriesService, ExpenseCategoriesRepository],
})
export class ExpenseCategoriesModule {}
