import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OnboardingGoal, OnboardingStep } from '@prisma/client';
import { UserPreferencesService } from './user-preferences.service.js';
import { UserPreferencesRepository } from './user-preferences.repository.js';
import { CurrenciesService } from '../currencies/currencies.service.js';
import { UserPreferencesEntity } from './domain/user-preferences.entity.js';
import { advanceStep } from './domain/onboarding.helper.js';

function preferences(overrides: Partial<ConstructorParameters<typeof UserPreferencesEntity>[0]> = {}) {
  return new UserPreferencesEntity({
    id: 'pref-1',
    userId: 'user-1',
    goal: null,
    timezone: 'America/Bogota',
    preferredCurrency: 'COP',
    remindersEnabled: true,
    renewalReminderDaysBefore: 3,
    reminderChannels: null,
    quietHoursStart: null,
    quietHoursEnd: null,
    onboardingStep: OnboardingStep.GOAL,
    onboardingCompleted: false,
    onboardingCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;
  let repository: { findOrCreateForUser: jest.Mock; updateForUser: jest.Mock };
  let currenciesService: { assertExists: jest.Mock };

  const userId = 'user-1';

  beforeEach(async () => {
    repository = {
      findOrCreateForUser: jest.fn().mockResolvedValue(preferences()),
      updateForUser: jest.fn().mockImplementation((_id, data) => Promise.resolve(preferences(data))),
    };
    currenciesService = {
      assertExists: jest.fn().mockImplementation((code: string) => Promise.resolve({ code, decimalDigits: 2 })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPreferencesService,
        { provide: UserPreferencesRepository, useValue: repository },
        { provide: CurrenciesService, useValue: currenciesService },
      ],
    }).compile();

    service = module.get(UserPreferencesService);
  });

  describe('advanceStep', () => {
    it('moves forward through the wizard', () => {
      expect(advanceStep(OnboardingStep.GOAL, OnboardingStep.REGION)).toBe(OnboardingStep.REGION);
    });

    it('never rewinds when an earlier answer is edited later', () => {
      expect(advanceStep(OnboardingStep.DONE, OnboardingStep.REGION)).toBe(OnboardingStep.DONE);
    });
  });

  describe('lazy creation', () => {
    it('creates the row with defaults on first read', async () => {
      const state = await service.getState(userId);

      expect(repository.findOrCreateForUser).toHaveBeenCalledWith(userId);
      expect(state.timezone).toBe('America/Bogota');
      expect(state.preferredCurrency).toBe('COP');
      expect(state.step).toBe(OnboardingStep.GOAL);
      expect(state.completed).toBe(false);
    });
  });

  describe('setGoal', () => {
    it('saves the goal and advances to the region step', async () => {
      await service.setGoal(userId, { goal: OnboardingGoal.SAVE_MONEY });

      expect(repository.updateForUser).toHaveBeenCalledWith(userId, {
        goal: OnboardingGoal.SAVE_MONEY,
        onboardingStep: OnboardingStep.REGION,
      });
    });

    it('does not rewind a user who already finished the wizard', async () => {
      repository.findOrCreateForUser.mockResolvedValueOnce(
        preferences({ onboardingStep: OnboardingStep.DONE, onboardingCompleted: true }),
      );

      await service.setGoal(userId, { goal: OnboardingGoal.MANAGE_FAMILY });

      const [, data] = repository.updateForUser.mock.calls[0];
      expect(data.onboardingStep).toBe(OnboardingStep.DONE);
    });
  });

  describe('setRegion', () => {
    it('saves timezone and currency, then advances to reminders', async () => {
      await service.setRegion(userId, { timezone: 'America/Mexico_City', preferredCurrency: 'MXN' });

      expect(currenciesService.assertExists).toHaveBeenCalledWith('MXN');
      expect(repository.updateForUser).toHaveBeenCalledWith(userId, {
        timezone: 'America/Mexico_City',
        preferredCurrency: 'MXN',
        onboardingStep: OnboardingStep.REMINDERS,
      });
    });

    it('rejects a timezone that is not an IANA identifier', async () => {
      await expect(
        service.setRegion(userId, { timezone: 'Mars/Olympus', preferredCurrency: 'COP' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.updateForUser).not.toHaveBeenCalled();
    });

    it('propagates an invalid currency as a 400', async () => {
      currenciesService.assertExists.mockRejectedValueOnce(new BadRequestException('moneda inválida'));

      await expect(
        service.setRegion(userId, { timezone: 'America/Bogota', preferredCurrency: 'ZZZ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setReminders', () => {
    it('persists the mock reminder settings and closes out the steps', async () => {
      await service.setReminders(userId, {
        remindersEnabled: false,
        renewalReminderDaysBefore: 7,
        reminderChannels: { push: true, email: false },
      });

      expect(repository.updateForUser).toHaveBeenCalledWith(userId, {
        remindersEnabled: false,
        renewalReminderDaysBefore: 7,
        reminderChannels: { push: true, email: false },
        onboardingStep: OnboardingStep.DONE,
      });
    });

    it('leaves untouched fields out of the update', async () => {
      await service.setReminders(userId, { remindersEnabled: true });

      const [, data] = repository.updateForUser.mock.calls[0];
      expect(data).not.toHaveProperty('renewalReminderDaysBefore');
      expect(data).not.toHaveProperty('quietHoursStart');
    });
  });

  describe('complete', () => {
    it('stamps the completion time', async () => {
      await service.complete(userId);

      const [, data] = repository.updateForUser.mock.calls[0];
      expect(data.onboardingCompleted).toBe(true);
      expect(data.onboardingCompletedAt).toBeInstanceOf(Date);
      expect(data.onboardingStep).toBe(OnboardingStep.DONE);
    });

    it('keeps the original completion time on a repeat call', async () => {
      const firstCompletedAt = new Date('2026-01-01T00:00:00.000Z');
      repository.findOrCreateForUser.mockResolvedValueOnce(
        preferences({ onboardingCompleted: true, onboardingCompletedAt: firstCompletedAt }),
      );

      await service.complete(userId);

      const [, data] = repository.updateForUser.mock.calls[0];
      expect(data.onboardingCompletedAt).toEqual(firstCompletedAt);
    });
  });

  describe('update', () => {
    it('validates both the timezone and the currency', async () => {
      await service.update(userId, { timezone: 'Europe/Madrid', preferredCurrency: 'EUR' });

      expect(repository.updateForUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ timezone: 'Europe/Madrid', preferredCurrency: 'EUR' }),
      );
    });

    it('does not advance the wizard', async () => {
      await service.update(userId, { goal: OnboardingGoal.TRACK_SPENDING });

      const [, data] = repository.updateForUser.mock.calls[0];
      expect(data).not.toHaveProperty('onboardingStep');
    });
  });
});
