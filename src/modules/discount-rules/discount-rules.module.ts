import { Module } from '@nestjs/common';
import { DiscountRulesService } from './discount-rules.service.js';
import { DiscountRulesController } from './discount-rules.controller.js';
import { DiscountRulesRepository } from './discount-rules.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [DiscountRulesController],
  providers: [DiscountRulesService, DiscountRulesRepository],
  exports: [DiscountRulesService],
})
export class DiscountRulesModule {}
