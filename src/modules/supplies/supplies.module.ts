import { Module } from '@nestjs/common';
import { SuppliesService } from './supplies.service.js';
import { SuppliesController } from './supplies.controller.js';
import { SuppliesRepository } from './supplies.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [SuppliesController],
  providers: [SuppliesService, SuppliesRepository],
  exports: [SuppliesService],
})
export class SuppliesModule {}
