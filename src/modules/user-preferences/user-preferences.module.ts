import { Module } from '@nestjs/common';
import { UserPreferencesService } from './user-preferences.service.js';
import { UserPreferencesController } from './user-preferences.controller.js';
import { OnboardingController } from './onboarding.controller.js';
import { UserPreferencesRepository } from './user-preferences.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { CurrenciesModule } from '../currencies/currencies.module.js';

@Module({
  imports: [PrismaModule, CurrenciesModule],
  controllers: [UserPreferencesController, OnboardingController],
  providers: [UserPreferencesService, UserPreferencesRepository],
  exports: [UserPreferencesService],
})
export class UserPreferencesModule {}
