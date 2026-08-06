import { Module } from '@nestjs/common';
import { SubscriptionCatalogService } from './subscription-catalog.service.js';
import { SubscriptionCatalogController } from './subscription-catalog.controller.js';
import { SubscriptionCatalogRepository } from './subscription-catalog.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionCatalogController],
  providers: [SubscriptionCatalogService, SubscriptionCatalogRepository],
  exports: [SubscriptionCatalogService],
})
export class SubscriptionCatalogModule {}
