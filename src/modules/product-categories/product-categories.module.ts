import { Module } from '@nestjs/common';
import { ProductCategoriesService } from './product-categories.service.js';
import { ProductCategoriesController } from './product-categories.controller.js';
import { ProductCategoriesRepository } from './product-categories.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ProductCategoriesController],
  providers: [ProductCategoriesService, ProductCategoriesRepository],
  exports: [ProductCategoriesService],
})
export class ProductCategoriesModule {}
