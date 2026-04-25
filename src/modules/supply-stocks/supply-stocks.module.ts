import { Module } from '@nestjs/common';
import { SupplyStocksService } from './supply-stocks.service.js';
import { SupplyStocksController } from './supply-stocks.controller.js';
import { SupplyStocksRepository } from './supply-stocks.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [SupplyStocksController],
  providers: [SupplyStocksService, SupplyStocksRepository],
  exports: [SupplyStocksService, SupplyStocksRepository],
})
export class SupplyStocksModule {}
