import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service.js';
import { RecipesController } from './recipes.controller.js';
import { RecipesRepository } from './recipes.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { SuppliesModule } from '../supplies/supplies.module.js';
import { ProductsModule } from '../products/products.module.js';

@Module({
  imports: [PrismaModule, SuppliesModule, ProductsModule],
  controllers: [RecipesController],
  providers: [RecipesService, RecipesRepository],
  exports: [RecipesService],
})
export class RecipesModule {}
