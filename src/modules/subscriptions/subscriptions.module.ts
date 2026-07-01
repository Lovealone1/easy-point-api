import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsRepository, SubscriptionLifecycleService, MailService],
  exports: [SubscriptionsService, SubscriptionLifecycleService],
})
export class SubscriptionsModule {}
