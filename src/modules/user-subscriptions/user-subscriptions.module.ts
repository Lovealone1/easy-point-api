import { Module } from '@nestjs/common';
import { UserSubscriptionsService } from './user-subscriptions.service.js';
import { UserSubscriptionsController } from './user-subscriptions.controller.js';
import { UserSubscriptionsRepository } from './user-subscriptions.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { SubscriptionCatalogModule } from '../subscription-catalog/subscription-catalog.module.js';
import { UserPaymentCardsModule } from '../user-payment-cards/user-payment-cards.module.js';

@Module({
  imports: [PrismaModule, SubscriptionCatalogModule, UserPaymentCardsModule],
  controllers: [UserSubscriptionsController],
  providers: [UserSubscriptionsService, UserSubscriptionsRepository],
  exports: [UserSubscriptionsService],
})
export class UserSubscriptionsModule {}
