import { Module } from '@nestjs/common';
import { UserSubscriptionCategoriesService } from './user-subscription-categories.service.js';
import { UserSubscriptionCategoriesController } from './user-subscription-categories.controller.js';
import { UserSubscriptionCategoriesRepository } from './user-subscription-categories.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [UserSubscriptionCategoriesController],
  providers: [UserSubscriptionCategoriesService, UserSubscriptionCategoriesRepository],
  exports: [UserSubscriptionCategoriesService],
})
export class UserSubscriptionCategoriesModule {}
