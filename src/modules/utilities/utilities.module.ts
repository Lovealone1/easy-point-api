import { Module } from '@nestjs/common';
import { UtilitiesService } from './utilities.service.js';
import { UtilitiesController } from './utilities.controller.js';
import { UtilitiesRepository } from './utilities.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [UtilitiesController],
  providers: [UtilitiesService, UtilitiesRepository],
  exports: [UtilitiesService], // exported so SalesModule can inject it
})
export class UtilitiesModule {}
