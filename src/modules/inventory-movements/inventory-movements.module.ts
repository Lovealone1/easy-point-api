import { Module } from '@nestjs/common';
import { InventoryMovementsService } from './inventory-movements.service.js';
import { InventoryMovementsController } from './inventory-movements.controller.js';
import { InventoryMovementsRepository } from './inventory-movements.repository.js';
import { ProductStocksModule } from '../product-stocks/product-stocks.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, ProductStocksModule],
  controllers: [InventoryMovementsController],
  providers: [InventoryMovementsService, InventoryMovementsRepository],
  exports: [InventoryMovementsService, InventoryMovementsRepository],
})
export class InventoryMovementsModule {}

