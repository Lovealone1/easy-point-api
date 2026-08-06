import { Module } from '@nestjs/common';
import { UserPaymentCardsService } from './user-payment-cards.service.js';
import { UserPaymentCardsController } from './user-payment-cards.controller.js';
import { UserPaymentCardsRepository } from './user-payment-cards.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [UserPaymentCardsController],
  providers: [UserPaymentCardsService, UserPaymentCardsRepository],
  exports: [UserPaymentCardsService],
})
export class UserPaymentCardsModule {}
