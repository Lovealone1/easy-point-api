import { BadRequestException, Injectable } from '@nestjs/common';
import { OnboardingStep, Prisma } from '@prisma/client';
import { UserPreferencesRepository } from './user-preferences.repository.js';
import { UserPreferencesEntity } from './domain/user-preferences.entity.js';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto.js';
import { UpdateOnboardingGoalDto } from './dto/update-onboarding-goal.dto.js';
import { UpdateOnboardingRegionDto } from './dto/update-onboarding-region.dto.js';
import { UpdateReminderPreferencesDto } from './dto/update-reminder-preferences.dto.js';
import { ONBOARDING_GOALS, advanceStep, isValidTimezone } from './domain/onboarding.helper.js';
import { CurrenciesService } from '../currencies/currencies.service.js';

export interface OnboardingState {
  step: OnboardingStep;
  completed: boolean;
  completedAt: Date | null;
  goal: UserPreferencesEntity['goal'];
  timezone: string;
  preferredCurrency: string;
  reminders: {
    enabled: boolean;
    renewalReminderDaysBefore: number;
    channels: Prisma.JsonValue | null;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
  };
}

@Injectable()
export class UserPreferencesService {
  constructor(
    private readonly preferencesRepository: UserPreferencesRepository,
    private readonly currenciesService: CurrenciesService,
  ) {}

  getGoalOptions() {
    return ONBOARDING_GOALS;
  }

  findForUser(userId: string): Promise<UserPreferencesEntity> {
    return this.preferencesRepository.findOrCreateForUser(userId);
  }

  /** The subset the FX conversion layer needs, without exposing the whole row. */
  async getPreferredCurrency(userId: string): Promise<string> {
    const preferences = await this.findForUser(userId);
    return preferences.preferredCurrency;
  }

  async update(userId: string, dto: UpdateUserPreferencesDto): Promise<UserPreferencesEntity> {
    await this.preferencesRepository.findOrCreateForUser(userId);

    const data: Prisma.UserPreferencesUpdateInput = {};

    if (dto.goal !== undefined) data.goal = dto.goal;
    if (dto.timezone !== undefined) data.timezone = this.assertTimezone(dto.timezone);
    if (dto.preferredCurrency !== undefined) {
      const currency = await this.currenciesService.assertExists(dto.preferredCurrency);
      data.preferredCurrency = currency.code;
    }
    if (dto.primaryColor !== undefined) data.primaryColor = dto.primaryColor;
    if (dto.defaultTheme !== undefined) data.defaultTheme = dto.defaultTheme;

    Object.assign(data, this.buildReminderData(dto));

    return this.preferencesRepository.updateForUser(userId, data);
  }

  async setGoal(userId: string, dto: UpdateOnboardingGoalDto): Promise<OnboardingState> {
    const current = await this.preferencesRepository.findOrCreateForUser(userId);

    const updated = await this.preferencesRepository.updateForUser(userId, {
      goal: dto.goal,
      onboardingStep: advanceStep(current.onboardingStep, OnboardingStep.REGION),
    });

    return this.toState(updated);
  }

  async setRegion(userId: string, dto: UpdateOnboardingRegionDto): Promise<OnboardingState> {
    const current = await this.preferencesRepository.findOrCreateForUser(userId);
    const currency = await this.currenciesService.assertExists(dto.preferredCurrency);

    const updated = await this.preferencesRepository.updateForUser(userId, {
      timezone: this.assertTimezone(dto.timezone),
      preferredCurrency: currency.code,
      onboardingStep: advanceStep(current.onboardingStep, OnboardingStep.REMINDERS),
    });

    return this.toState(updated);
  }

  async setReminders(userId: string, dto: UpdateReminderPreferencesDto): Promise<OnboardingState> {
    const current = await this.preferencesRepository.findOrCreateForUser(userId);

    const updated = await this.preferencesRepository.updateForUser(userId, {
      ...this.buildReminderData(dto),
      onboardingStep: advanceStep(current.onboardingStep, OnboardingStep.DONE),
    });

    return this.toState(updated);
  }

  async complete(userId: string): Promise<OnboardingState> {
    const current = await this.preferencesRepository.findOrCreateForUser(userId);

    // Re-completing is a no-op on the timestamp: the first completion is the
    // one worth knowing about.
    const updated = await this.preferencesRepository.updateForUser(userId, {
      onboardingStep: OnboardingStep.DONE,
      onboardingCompleted: true,
      onboardingCompletedAt: current.onboardingCompletedAt ?? new Date(),
    });

    return this.toState(updated);
  }

  async getState(userId: string): Promise<OnboardingState> {
    return this.toState(await this.preferencesRepository.findOrCreateForUser(userId));
  }

  private buildReminderData(dto: UpdateReminderPreferencesDto): Prisma.UserPreferencesUpdateInput {
    const data: Prisma.UserPreferencesUpdateInput = {};

    if (dto.remindersEnabled !== undefined) data.remindersEnabled = dto.remindersEnabled;
    if (dto.renewalReminderDaysBefore !== undefined) {
      data.renewalReminderDaysBefore = dto.renewalReminderDaysBefore;
    }
    if (dto.reminderChannels !== undefined) data.reminderChannels = dto.reminderChannels;
    if (dto.quietHoursStart !== undefined) data.quietHoursStart = dto.quietHoursStart;
    if (dto.quietHoursEnd !== undefined) data.quietHoursEnd = dto.quietHoursEnd;

    return data;
  }

  private assertTimezone(timezone: string): string {
    const value = timezone.trim();
    if (!isValidTimezone(value)) {
      throw new BadRequestException(
        `La zona horaria "${timezone}" no es válida. Debe ser un identificador IANA (ej: America/Bogota).`,
      );
    }
    return value;
  }

  private toState(preferences: UserPreferencesEntity): OnboardingState {
    return {
      step: preferences.onboardingStep,
      completed: preferences.onboardingCompleted,
      completedAt: preferences.onboardingCompletedAt,
      goal: preferences.goal,
      timezone: preferences.timezone,
      preferredCurrency: preferences.preferredCurrency,
      reminders: {
        enabled: preferences.remindersEnabled,
        renewalReminderDaysBefore: preferences.renewalReminderDaysBefore,
        channels: preferences.reminderChannels,
        quietHoursStart: preferences.quietHoursStart,
        quietHoursEnd: preferences.quietHoursEnd,
      },
    };
  }
}
