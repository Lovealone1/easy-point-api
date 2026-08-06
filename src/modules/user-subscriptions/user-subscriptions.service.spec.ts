import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingCycle, CardBrand, Prisma, UserSubscriptionStatus } from '@prisma/client';
import { UserSubscriptionsService } from './user-subscriptions.service.js';
import { UserSubscriptionsRepository } from './user-subscriptions.repository.js';
import { SubscriptionCatalogService } from '../subscription-catalog/subscription-catalog.service.js';
import { UserPaymentCardsService } from '../user-payment-cards/user-payment-cards.service.js';
import { UserSubscriptionEntity } from './domain/user-subscription.entity.js';
import { SubscriptionProviderEntity } from '../subscription-catalog/domain/subscription-provider.entity.js';
import { SubscriptionCategoryEntity } from '../subscription-catalog/domain/subscription-category.entity.js';
import { UserPaymentCardEntity } from '../user-payment-cards/domain/user-payment-card.entity.js';

describe('UserSubscriptionsService', () => {
  let service: UserSubscriptionsService;
  let repository: jest.Mocked<UserSubscriptionsRepository>;
  let catalogService: jest.Mocked<SubscriptionCatalogService>;
  let cardsService: jest.Mocked<UserPaymentCardsService>;

  const userId = 'user-1';

  const mockCategory = new SubscriptionCategoryEntity({
    id: 'cat-1',
    key: 'entertainment',
    name: 'Entretenimiento',
    icon: null,
    color: null,
    sortOrder: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockProvider = new SubscriptionProviderEntity({
    id: 'prov-1',
    key: 'netflix',
    name: 'Netflix',
    categoryId: 'cat-1',
    logoUrl: 'https://cdn.example.com/netflix.png',
    brandColor: '#E50914',
    websiteUrl: null,
    description: null,
    isActive: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: mockCategory,
  });

  const mockCard = new UserPaymentCardEntity({
    id: 'card-1',
    userId,
    label: 'Nubank',
    brand: CardBrand.MASTERCARD,
    color: '#8A05BE',
    lastFourDigits: null,
    statementDay: 15,
    paymentDueDay: null,
    isDefault: false,
    isActive: true,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  function buildSubscription(overrides: Partial<ConstructorParameters<typeof UserSubscriptionEntity>[0]> = {}) {
    return new UserSubscriptionEntity({
      id: 'sub-1',
      userId,
      providerId: 'prov-1',
      customName: null,
      customLogoUrl: null,
      customCategoryId: null,
      cardId: 'card-1',
      planLabel: null,
      amount: new Prisma.Decimal(34900),
      currency: 'COP',
      billingCycle: BillingCycle.MONTHLY,
      startedAt: new Date('2026-01-10T00:00:00.000Z'),
      nextBillingDate: new Date('2026-08-10T00:00:00.000Z'),
      status: UserSubscriptionStatus.ACTIVE,
      isTrial: false,
      trialEndsAt: null,
      cancelledAt: null,
      notes: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: mockProvider,
      customCategory: null,
      card: mockCard,
      ...overrides,
    });
  }

  beforeEach(async () => {
    const mockRepository = {
      findManyWithCount: jest.fn(),
      findByIdAndUser: jest.fn(),
      findAllActiveForUser: jest.fn(),
      findAllActiveWithUsageLogsForUser: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findPriceHistory: jest.fn(),
      findLatestTwoPriceSnapshots: jest.fn(),
      upsertUsageCheckin: jest.fn(),
      findUsageCheckins: jest.fn(),
      findAllUsageLogs: jest.fn(),
    };

    const mockCatalogService = {
      findOneProvider: jest.fn(),
      findOneCategory: jest.fn(),
    };

    const mockCardsService = {
      findOneForUser: jest.fn(),
      findAllForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSubscriptionsService,
        { provide: UserSubscriptionsRepository, useValue: mockRepository },
        { provide: SubscriptionCatalogService, useValue: mockCatalogService },
        { provide: UserPaymentCardsService, useValue: mockCardsService },
      ],
    }).compile();

    service = module.get<UserSubscriptionsService>(UserSubscriptionsService);
    repository = module.get(UserSubscriptionsRepository) as any;
    catalogService = module.get(SubscriptionCatalogService) as any;
    cardsService = module.get(UserPaymentCardsService) as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('throws BadRequestException when neither providerId nor custom fields are given', async () => {
      await expect(
        service.create(userId, {
          amount: 100,
          billingCycle: BillingCycle.MONTHLY,
          startedAt: '2026-01-01',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('validates the provider and card, then creates with an initial price snapshot', async () => {
      catalogService.findOneProvider.mockResolvedValueOnce(mockProvider);
      cardsService.findOneForUser.mockResolvedValueOnce(mockCard);
      const created = buildSubscription();
      repository.create.mockResolvedValueOnce(created);

      const result = await service.create(userId, {
        providerId: 'prov-1',
        cardId: 'card-1',
        amount: 34900,
        billingCycle: BillingCycle.MONTHLY,
        startedAt: '2026-01-10',
      });

      expect(result).toBe(created);
      expect(catalogService.findOneProvider).toHaveBeenCalledWith('prov-1');
      expect(cardsService.findOneForUser).toHaveBeenCalledWith('card-1', userId);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: new Prisma.Decimal(34900), currency: 'COP' }),
        { amount: new Prisma.Decimal(34900), currency: 'COP', effectiveFrom: new Date('2026-01-10T00:00:00.000Z') },
      );
    });

    it('derives nextBillingDate from startedAt + billingCycle when not provided', async () => {
      catalogService.findOneProvider.mockResolvedValueOnce(mockProvider);
      repository.create.mockResolvedValueOnce(buildSubscription());

      await service.create(userId, {
        providerId: 'prov-1',
        amount: 100,
        billingCycle: BillingCycle.MONTHLY,
        startedAt: '2026-01-10',
      });

      const [createArgs] = repository.create.mock.calls[0];
      expect(createArgs.nextBillingDate).toEqual(new Date('2026-02-10T00:00:00.000Z'));
    });

    it('validates the custom category when no providerId is given', async () => {
      catalogService.findOneCategory.mockResolvedValueOnce(mockCategory);
      repository.create.mockResolvedValueOnce(buildSubscription({ providerId: null, customName: 'Gym', customCategoryId: 'cat-1', provider: null, customCategory: mockCategory }));

      await service.create(userId, {
        customName: 'Gym',
        customCategoryId: 'cat-1',
        amount: 50000,
        billingCycle: BillingCycle.YEARLY,
        startedAt: '2026-01-01',
      });

      expect(catalogService.findOneCategory).toHaveBeenCalledWith('cat-1');
      expect(catalogService.findOneProvider).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the subscription does not belong to the user', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(null);
      await expect(service.update('sub-1', userId, { amount: 100 })).rejects.toThrow(NotFoundException);
    });

    it('creates a price snapshot when amount changes', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(buildSubscription());
      repository.update.mockResolvedValueOnce(buildSubscription({ amount: new Prisma.Decimal(39900) }));

      await service.update('sub-1', userId, { amount: 39900 });

      expect(repository.update).toHaveBeenCalledWith(
        'sub-1',
        expect.objectContaining({ amount: new Prisma.Decimal(39900) }),
        expect.objectContaining({ amount: new Prisma.Decimal(39900), currency: 'COP' }),
      );
    });

    it('does not create a price snapshot when amount is unchanged', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(buildSubscription());
      repository.update.mockResolvedValueOnce(buildSubscription());

      await service.update('sub-1', userId, { notes: 'nueva nota' });

      expect(repository.update).toHaveBeenCalledWith('sub-1', expect.objectContaining({ notes: 'nueva nota' }), undefined);
    });
  });

  describe('updateStatus', () => {
    it('sets cancelledAt when transitioning to CANCELLED', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(buildSubscription());
      repository.update.mockResolvedValueOnce(buildSubscription({ status: UserSubscriptionStatus.CANCELLED }));

      await service.updateStatus('sub-1', userId, UserSubscriptionStatus.CANCELLED);

      const [, data] = repository.update.mock.calls[0];
      expect(data).toEqual(expect.objectContaining({ status: UserSubscriptionStatus.CANCELLED, cancelledAt: expect.any(Date) }));
    });

    it('does not set cancelledAt for other status transitions', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(buildSubscription());
      repository.update.mockResolvedValueOnce(buildSubscription({ status: UserSubscriptionStatus.PAUSED }));

      await service.updateStatus('sub-1', userId, UserSubscriptionStatus.PAUSED);

      const [, data] = repository.update.mock.calls[0];
      expect(data).toEqual({ status: UserSubscriptionStatus.PAUSED });
    });
  });

  describe('getSummary', () => {
    it('aggregates monthly totals across active subscriptions, normalizing by billing cycle', async () => {
      const monthly = buildSubscription({ id: 'sub-1', amount: new Prisma.Decimal(34900), billingCycle: BillingCycle.MONTHLY });
      const yearly = buildSubscription({
        id: 'sub-2',
        amount: new Prisma.Decimal(120000),
        billingCycle: BillingCycle.YEARLY,
        cardId: null,
        card: null,
        provider: null,
        customName: 'Gimnasio',
        customCategory: mockCategory,
      });
      repository.findAllActiveForUser.mockResolvedValueOnce([monthly, yearly]);

      const summary = await service.getSummary(userId, {});

      expect(summary.monthlyTotal).toBe('44900.00'); // 34900 + 120000/12
      expect(summary.activeCount).toBe(2);
      expect(summary.byCard).toHaveLength(2); // one real card + "Sin tarjeta asignada"
    });

    it('excludes PAUSED subscriptions from monthlyTotal but counts them separately', async () => {
      const paused = buildSubscription({ status: UserSubscriptionStatus.PAUSED });
      repository.findAllActiveForUser.mockResolvedValueOnce([paused]);

      const summary = await service.getSummary(userId, {});

      expect(summary.monthlyTotal).toBe('0.00');
      expect(summary.pausedCount).toBe(1);
      expect(summary.activeCount).toBe(0);
    });
  });

  describe('price history', () => {
    it('getPriceHistory returns formatted snapshots after verifying ownership', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(buildSubscription());
      repository.findPriceHistory.mockResolvedValueOnce([
        { id: 'ph-2', amount: new Prisma.Decimal(39900), currency: 'COP', effectiveFrom: new Date(), createdAt: new Date() },
        { id: 'ph-1', amount: new Prisma.Decimal(34900), currency: 'COP', effectiveFrom: new Date(), createdAt: new Date() },
      ]);

      const history = await service.getPriceHistory('sub-1', userId);

      expect(history).toHaveLength(2);
      expect(history[0].amount).toBe('39900.00');
    });

    it('getDetailForUser computes a lastPriceChange badge when the most recent change is within 90 days', async () => {
      const now = new Date();
      repository.findByIdAndUser.mockResolvedValueOnce(buildSubscription());
      repository.findLatestTwoPriceSnapshots.mockResolvedValueOnce([
        { amount: new Prisma.Decimal(39900), currency: 'COP', createdAt: now },
        { amount: new Prisma.Decimal(34900), currency: 'COP', createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
      ]);

      const detail = await service.getDetailForUser('sub-1', userId);

      expect(detail.lastPriceChange).toEqual(
        expect.objectContaining({ previousAmount: '34900.00', newAmount: '39900.00', changePercent: 14.3 }),
      );
    });

    it('getDetailForUser omits lastPriceChange when the change happened more than 90 days ago', async () => {
      const now = new Date();
      const oldChange = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
      repository.findByIdAndUser.mockResolvedValueOnce(buildSubscription());
      repository.findLatestTwoPriceSnapshots.mockResolvedValueOnce([
        { amount: new Prisma.Decimal(39900), currency: 'COP', createdAt: oldChange },
        { amount: new Prisma.Decimal(34900), currency: 'COP', createdAt: new Date(oldChange.getTime() - 1000) },
      ]);

      const detail = await service.getDetailForUser('sub-1', userId);

      expect(detail.lastPriceChange).toBeNull();
    });

    it('getDetailForUser returns null when there is only one snapshot', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(buildSubscription());
      repository.findLatestTwoPriceSnapshots.mockResolvedValueOnce([
        { amount: new Prisma.Decimal(34900), currency: 'COP', createdAt: new Date() },
      ]);

      const detail = await service.getDetailForUser('sub-1', userId);

      expect(detail.lastPriceChange).toBeNull();
    });
  });

  describe('usage check-ins and zombie detection', () => {
    it('logUsageCheckin verifies ownership before upserting', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(buildSubscription());
      repository.upsertUsageCheckin.mockResolvedValueOnce({ id: 'log-1', date: new Date('2026-08-06'), used: true });

      await service.logUsageCheckin('sub-1', userId, { used: true, date: '2026-08-06' });

      // Built the same way the service normalizes it (local start-of-day),
      // to stay independent of the test runner's timezone offset.
      const expectedDate = new Date('2026-08-06');
      expectedDate.setHours(0, 0, 0, 0);
      expect(repository.upsertUsageCheckin).toHaveBeenCalledWith('sub-1', expectedDate, true);
    });

    it('logUsageCheckin throws NotFoundException for a subscription owned by another user', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(null);
      await expect(service.logUsageCheckin('sub-1', userId, { used: true })).rejects.toThrow(NotFoundException);
    });

    it('getZombieCandidates only returns subscriptions flagged by computeUsageStats, sorted by spend', async () => {
      const now = new Date();
      const oldStartedAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const lowUsageLogs = Array.from({ length: 6 }, (_, i) => ({
        date: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
        used: i === 0,
      }));

      const zombieCandidate = Object.assign(
        buildSubscription({ id: 'sub-zombie', amount: new Prisma.Decimal(39900), startedAt: oldStartedAt }),
        { usageLogs: lowUsageLogs },
      );
      const healthySubscription = Object.assign(
        buildSubscription({
          id: 'sub-healthy',
          amount: new Prisma.Decimal(10000),
          startedAt: oldStartedAt,
          providerId: 'prov-2',
        }),
        { usageLogs: Array.from({ length: 6 }, (_, i) => ({ date: new Date(now.getTime() - i * 24 * 60 * 60 * 1000), used: true })) },
      );

      repository.findAllActiveWithUsageLogsForUser.mockResolvedValueOnce([zombieCandidate, healthySubscription] as any);

      const candidates = await service.getZombieCandidates(userId);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('sub-zombie');
      expect(candidates[0].isZombieCandidate).toBe(true);
    });
  });

  describe('getCashFlowCalendar', () => {
    it('projects charges into the requested month and groups totals by card cycle', async () => {
      // Local-time constructor (not a UTC 'Z' ISO string) — matches how the
      // service builds its month range boundaries, avoiding a day-off diff
      // across timezones.
      const sub = buildSubscription({
        nextBillingDate: new Date(2026, 7, 10),
        billingCycle: BillingCycle.MONTHLY,
      });
      repository.findAllActiveForUser.mockResolvedValueOnce([sub]);
      cardsService.findAllForUser.mockResolvedValueOnce([mockCard]);

      const calendar = await service.getCashFlowCalendar(userId, { month: '2026-08' });

      expect(calendar.days).toHaveLength(1);
      expect(calendar.days[0].date).toBe('2026-08-10');
      expect(calendar.days[0].total).toBe('34900.00');

      const cardSummary = calendar.byCard.find((c) => c.cardId === 'card-1')!;
      expect(cardSummary.needsSetup).toBe(false);
      expect(cardSummary.cycleTotal).toBe('34900.00');
    });

    it('flags cards without a configured statementDay as needsSetup', async () => {
      const cardWithoutStatementDay = new UserPaymentCardEntity({ ...mockCard, statementDay: null });
      repository.findAllActiveForUser.mockResolvedValueOnce([]);
      cardsService.findAllForUser.mockResolvedValueOnce([cardWithoutStatementDay]);

      const calendar = await service.getCashFlowCalendar(userId, { month: '2026-08' });

      expect(calendar.byCard[0].needsSetup).toBe(true);
      expect(calendar.byCard[0].currentCycle).toBeNull();
    });
  });
});
