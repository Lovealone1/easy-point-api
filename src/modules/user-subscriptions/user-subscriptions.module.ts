import { Module } from '@nestjs/common';
import { UserSubscriptionsService } from './user-subscriptions.service.js';
import { UserSubscriptionsController } from './user-subscriptions.controller.js';
import { UserSubscriptionsRepository } from './user-subscriptions.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { SubscriptionCatalogModule } from '../subscription-catalog/subscription-catalog.module.js';
import { UserPaymentCardsModule } from '../user-payment-cards/user-payment-cards.module.js';
import { CurrenciesModule } from '../currencies/currencies.module.js';
import { UserSubscriptionCategoriesModule } from '../user-subscription-categories/user-subscription-categories.module.js';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module.js';
import { UserPreferencesModule } from '../user-preferences/user-preferences.module.js';

@Module({
  imports: [
    PrismaModule,
    SubscriptionCatalogModule,
    UserPaymentCardsModule,
    UserSubscriptionCategoriesModule,
    CurrenciesModule,
    ExchangeRatesModule,
    UserPreferencesModule,
  ],
  controllers: [UserSubscriptionsController],
  providers: [UserSubscriptionsService, UserSubscriptionsRepository],
  exports: [UserSubscriptionsService],
})
export class UserSubscriptionsModule {}
