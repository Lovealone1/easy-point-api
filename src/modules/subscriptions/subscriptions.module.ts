import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsMeController } from './subscriptions-me.controller.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';

@Module({
  imports: [PrismaModule],
  // SubscriptionsMeController ('subscriptions/me') must be registered before
  // SubscriptionsController (whose 'subscriptions/:id' would otherwise shadow
  // it, matching id="me").
  controllers: [SubscriptionsMeController, SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsRepository, SubscriptionLifecycleService, MailService],
  exports: [SubscriptionsService, SubscriptionLifecycleService],
})
export class SubscriptionsModule {}
