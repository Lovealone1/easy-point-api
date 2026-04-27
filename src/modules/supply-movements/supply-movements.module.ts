import { Module } from '@nestjs/common';
import { SupplyMovementsService } from './supply-movements.service.js';
import { SupplyMovementsController } from './supply-movements.controller.js';
import { SupplyMovementsRepository } from './supply-movements.repository.js';
import { SupplyStocksModule } from '../supply-stocks/supply-stocks.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, SupplyStocksModule],
  controllers: [SupplyMovementsController],
  providers: [SupplyMovementsService, SupplyMovementsRepository],
  exports: [SupplyMovementsService, SupplyMovementsRepository],
})
export class SupplyMovementsModule {}

