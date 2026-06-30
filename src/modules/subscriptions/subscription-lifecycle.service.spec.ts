import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import appConfig from '../../common/config/config.js';
import { SubscriptionStatus } from '@prisma/client';

describe('SubscriptionLifecycleService', () => {
  let service: SubscriptionLifecycleService;
  let prisma: any;

  const mockPlan = { id: 'plan-1', name: 'Premium Plan', monthlyPrice: 100, yearlyPrice: 1000 };
  const mockFreePlan = { id: 'plan-free', name: 'Free Plan', monthlyPrice: 0, yearlyPrice: 0 };

  const mockPrismaService = {
    subscription: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    subscriptionStatusLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => {
      const mockTx = {
        subscription: {
          update: mockPrismaService.subscription.update,
        },
        subscriptionStatusLog: {
          create: mockPrismaService.subscriptionStatusLog.create,
        },
      };
      return cb(mockTx);
    }),
  };

  const mockConfig = {
    cron: {
      subscriptionCheck: '0 0 * * *',
    },
    subscriptions: {
      gracePeriodDays: 3,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: appConfig.KEY,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<SubscriptionLifecycleService>(SubscriptionLifecycleService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('expireDueSubscriptions', () => {
    it('should transition due paid subscriptions to EXPIRED and write status logs', async () => {
      const mockSub = {
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
        plan: mockPlan,
      };

      prisma.subscription.findMany.mockResolvedValue([mockSub]);

      await service.expireDueSubscriptions();

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      expect(prisma.subscriptionStatusLog.create).toHaveBeenCalledWith({
        data: {
          subscriptionId: 'sub-1',
          fromStatus: SubscriptionStatus.ACTIVE,
          toStatus: SubscriptionStatus.EXPIRED,
          reason: 'Subscription period ended (currentPeriodEnd reached)',
          triggeredBy: 'cron',
        },
      });
    });

    it('should ignore FREE subscriptions', async () => {
      const mockSubFree = {
        id: 'sub-free',
        status: SubscriptionStatus.ACTIVE,
        plan: mockFreePlan,
      };

      prisma.subscription.findMany.mockResolvedValue([mockSubFree]);

      await service.expireDueSubscriptions();

      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(prisma.subscriptionStatusLog.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelGraceExceededSubscriptions', () => {
    it('should transition grace period exceeded subscriptions to CANCELLED', async () => {
      const expiredAt = new Date();
      // 4 days ago (grace period is 3 days)
      expiredAt.setDate(expiredAt.getDate() - 4);

      const mockSub = {
        id: 'sub-expired',
        status: SubscriptionStatus.EXPIRED,
        updatedAt: expiredAt,
        statusLogs: [
          {
            id: 'log-1',
            toStatus: SubscriptionStatus.EXPIRED,
            createdAt: expiredAt,
          },
        ],
      };

      prisma.subscription.findMany.mockResolvedValue([mockSub]);

      await service.cancelGraceExceededSubscriptions();

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-expired' },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        },
      });
      expect(prisma.subscriptionStatusLog.create).toHaveBeenCalledWith({
        data: {
          subscriptionId: 'sub-expired',
          fromStatus: SubscriptionStatus.EXPIRED,
          toStatus: SubscriptionStatus.CANCELLED,
          reason: 'Grace period of 3 days exceeded',
          triggeredBy: 'cron',
        },
      });
    });

    it('should not transition expired subscriptions within the grace period', async () => {
      const expiredAt = new Date();
      // 1 day ago (grace period is 3 days)
      expiredAt.setDate(expiredAt.getDate() - 1);

      const mockSub = {
        id: 'sub-expired-recent',
        status: SubscriptionStatus.EXPIRED,
        updatedAt: expiredAt,
        statusLogs: [
          {
            id: 'log-1',
            toStatus: SubscriptionStatus.EXPIRED,
            createdAt: expiredAt,
          },
        ],
      };

      prisma.subscription.findMany.mockResolvedValue([mockSub]);

      await service.cancelGraceExceededSubscriptions();

      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(prisma.subscriptionStatusLog.create).not.toHaveBeenCalled();
    });
  });
});
