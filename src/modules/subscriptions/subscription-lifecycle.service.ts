import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SubscriptionStatus } from '@prisma/client';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../common/config/config.js';

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  /**
   * Main driver called by the nightly cron job.
   */
  async processSubscriptionLifecycle() {
    this.logger.log('Starting nightly subscription lifecycle check...');
    try {
      await this.expireDueSubscriptions();
      await this.cancelGraceExceededSubscriptions();
      this.logger.log('Nightly subscription lifecycle check finished.');
    } catch (error: any) {
      this.logger.error('Error processing subscription lifecycle', error.stack);
    }
  }

  /**
   * Moves active subscriptions whose current period ends today or in the past into EXPIRED.
   * Free and already cancelled/expired subscriptions are excluded.
   */
  async expireDueSubscriptions() {
    this.logger.log('Validating subscriptions for expiration checks...');
    const today = new Date();

    // Find subscriptions that are due/past their end period and are in active/trialing/pending payment states
    const dueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        currentPeriodEnd: {
          lte: today,
        },
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PENDING_PAYMENT, SubscriptionStatus.PAST_DUE],
        },
      },
      include: {
        plan: true,
      },
    });

    // Don't expire FREE plans
    const nonFreeDueSubs = dueSubscriptions.filter(
      sub => !sub.plan.name.toLowerCase().includes('free')
    );

    this.logger.log(`Found ${nonFreeDueSubs.length} subscription(s) due for expiration (currentPeriodEnd <= ${today.toISOString()}).`);

    for (const sub of nonFreeDueSubs) {
      const oldStatus = sub.status;
      const newStatus = SubscriptionStatus.EXPIRED;

      await this.prisma.$transaction(async (tx) => {
        // Update subscription status
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: newStatus },
        });

        // Add log entry
        await tx.subscriptionStatusLog.create({
          data: {
            subscriptionId: sub.id,
            fromStatus: oldStatus,
            toStatus: newStatus,
            reason: 'Subscription period ended (currentPeriodEnd reached)',
            triggeredBy: 'cron',
          },
        });
      });

      this.logger.log(`Subscription ${sub.id} transitioned from ${oldStatus} to EXPIRED.`);
    }
  }

  /**
   * Cancels subscriptions in EXPIRED status for longer than the grace period.
   */
  async cancelGraceExceededSubscriptions() {
    this.logger.log('Validating expired subscriptions for grace-period checks...');
    const gracePeriodDays = this.config.subscriptions.gracePeriodDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

    // Find subscriptions in EXPIRED status
    const expiredSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.EXPIRED,
      },
      include: {
        statusLogs: {
          where: {
            toStatus: SubscriptionStatus.EXPIRED,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        },
      },
    });

    this.logger.log(`Found ${expiredSubscriptions.length} expired subscription(s) to check for grace period limits (Grace Period: ${gracePeriodDays} days).`);

    for (const sub of expiredSubscriptions) {
      const expiredLog = sub.statusLogs[0];
      if (!expiredLog) {
        // Fallback: use updatedAt if no status log entry was recorded for some reason
        const elapsedMs = new Date().getTime() - new Date(sub.updatedAt).getTime();
        const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
        if (elapsedDays >= gracePeriodDays) {
          await this.cancelSubscription(sub.id, sub.status, `Grace period exceeded (no logs, elapsed days: ${Math.floor(elapsedDays)})`);
        }
        continue;
      }

      const elapsedMs = new Date().getTime() - new Date(expiredLog.createdAt).getTime();
      const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

      if (elapsedDays >= gracePeriodDays) {
        await this.cancelSubscription(sub.id, sub.status, `Grace period of ${gracePeriodDays} days exceeded`);
      }
    }
  }

  private async cancelSubscription(subId: string, oldStatus: SubscriptionStatus, reason: string) {
    const newStatus = SubscriptionStatus.CANCELLED;

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subId },
        data: {
          status: newStatus,
          cancelledAt: new Date(),
        },
      });

      await tx.subscriptionStatusLog.create({
        data: {
          subscriptionId: subId,
          fromStatus: oldStatus,
          toStatus: newStatus,
          reason,
          triggeredBy: 'cron',
        },
      });
    });

    this.logger.log(`Subscription ${subId} automatically CANCELLED: ${reason}.`);
  }
}
