import { OnboardingGoal, OnboardingStep, Prisma, Theme } from '@prisma/client';

export class UserPreferencesEntity {
  readonly id: string;
  readonly userId: string;
  goal: OnboardingGoal | null;
  timezone: string;
  preferredCurrency: string;
  remindersEnabled: boolean;
  renewalReminderDaysBefore: number;
  reminderChannels: Prisma.JsonValue | null;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  primaryColor: string | null;
  defaultTheme: Theme;
  onboardingStep: OnboardingStep;
  onboardingCompleted: boolean;
  onboardingCompletedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    userId: string;
    goal: OnboardingGoal | null;
    timezone: string;
    preferredCurrency: string;
    remindersEnabled: boolean;
    renewalReminderDaysBefore: number;
    reminderChannels: Prisma.JsonValue | null;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
    primaryColor: string | null;
    defaultTheme: Theme;
    onboardingStep: OnboardingStep;
    onboardingCompleted: boolean;
    onboardingCompletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    Object.assign(this, params);
  }

  static fromPrisma(raw: ConstructorParameters<typeof UserPreferencesEntity>[0]): UserPreferencesEntity {
    return new UserPreferencesEntity(raw);
  }
}
