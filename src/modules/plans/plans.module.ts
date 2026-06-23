import { Module } from '@nestjs/common';
import { PlansService } from './plans.service.js';
import { PlansController } from './plans.controller.js';
import { PlansRepository } from './plans.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PlansController],
  providers: [PlansService, PlansRepository],
  exports: [PlansService],
})
export class PlansModule {}
