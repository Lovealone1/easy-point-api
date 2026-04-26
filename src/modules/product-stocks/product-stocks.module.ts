import { Module } from '@nestjs/common';
import { ProductStocksService } from './product-stocks.service.js';
import { ProductStocksController } from './product-stocks.controller.js';
import { ProductStocksRepository } from './product-stocks.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ProductStocksController],
  providers: [ProductStocksService, ProductStocksRepository],
  exports: [ProductStocksService, ProductStocksRepository], // Exported because InventoryMovements will need them
})
export class ProductStocksModule {}
