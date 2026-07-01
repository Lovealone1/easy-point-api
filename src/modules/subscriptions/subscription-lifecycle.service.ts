import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SubscriptionStatus } from '@prisma/client';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../common/config/config.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';
import {
  getSubscriptionRenewalReminderTemplate,
  getSubscriptionCancelledTemplate,
} from '../../infraestructure/mail/templates/subscription.template.js';

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
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
   * Also sends a renewal reminder email to the organization email and owner.
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

      // Send renewal reminder emails (grace period days = days left to renew before cancellation)
      await this.sendRenewalReminderEmails(sub.id, sub.organizationId, sub.plan.name);
    }
  }

  /**
   * Cancels subscriptions in EXPIRED status for longer than the grace period.
   * Also sends a cancellation email to the organization email and owner.
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
        plan: true,
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
          await this.cancelSubscription(sub.id, sub.organizationId, sub.plan.name, sub.status, `Grace period exceeded (no logs, elapsed days: ${Math.floor(elapsedDays)})`);
        }
        continue;
      }

      const elapsedMs = new Date().getTime() - new Date(expiredLog.createdAt).getTime();
      const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

      if (elapsedDays >= gracePeriodDays) {
        await this.cancelSubscription(sub.id, sub.organizationId, sub.plan.name, sub.status, `Grace period of ${gracePeriodDays} days exceeded`);
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async cancelSubscription(
    subId: string,
    organizationId: string,
    planName: string,
    oldStatus: SubscriptionStatus,
    reason: string,
  ) {
    const newStatus = SubscriptionStatus.CANCELLED;
    const cancelledAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subId },
        data: {
          status: newStatus,
          cancelledAt,
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

    // Send cancellation emails after the DB transaction completes successfully
    await this.sendCancellationEmails(subId, organizationId, planName, cancelledAt);
  }

  /**
   * Collects the organization's own email and the owner user's email,
   * then dispatches the renewal reminder template to both.
   */
  private async sendRenewalReminderEmails(
    subscriptionId: string,
    organizationId: string,
    planName: string,
  ) {
    try {
      const gracePeriodDays = this.config.subscriptions.gracePeriodDays;
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + gracePeriodDays);

      const { organization, ownerEmail, recipients } = await this.resolveOrgAndOwner(organizationId);
      if (recipients.length === 0) {
        this.logger.warn(`No email recipients found for organization ${organizationId} (subscription ${subscriptionId}). Skipping renewal reminder.`);
        return;
      }

      const logoUrl = `${this.config.app.apiBaseUrl.replace(/\/api$/, '')}/easypoint-resumed.png`;
      const renewalLink = `${this.config.app.frontendUrl}/dashboard/billing`;
      const formattedDate = renewalDate.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const html = getSubscriptionRenewalReminderTemplate({
        organizationName: organization.name,
        planName,
        daysLeft: gracePeriodDays,
        renewalDate: formattedDate,
        renewalLink,
        logoUrl,
      });

      const subject = `⚠️ Tu suscripción a ${planName} ha expirado — te quedan ${gracePeriodDays} días para renovar`;

      for (const email of recipients) {
        await this.mailService.sendMail(email, subject, html);
        this.logger.log(`Renewal reminder sent to ${email} for subscription ${subscriptionId}.`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send renewal reminder emails for subscription ${subscriptionId}`, error.stack);
    }
  }

  /**
   * Collects the organization's own email and the owner user's email,
   * then dispatches the cancellation template to both.
   */
  private async sendCancellationEmails(
    subscriptionId: string,
    organizationId: string,
    planName: string,
    cancelledAt: Date,
  ) {
    try {
      const { organization, ownerEmail, recipients } = await this.resolveOrgAndOwner(organizationId);
      if (recipients.length === 0) {
        this.logger.warn(`No email recipients found for organization ${organizationId} (subscription ${subscriptionId}). Skipping cancellation notice.`);
        return;
      }

      const logoUrl = `${this.config.app.apiBaseUrl.replace(/\/api$/, '')}/easypoint-resumed.png`;
      const reactivateLink = `${this.config.app.frontendUrl}/dashboard/billing`;
      const formattedDate = cancelledAt.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const html = getSubscriptionCancelledTemplate({
        organizationName: organization.name,
        planName,
        cancelledAt: formattedDate,
        reactivateLink,
        logoUrl,
      });

      const subject = `Tu suscripción a ${planName} ha sido cancelada — Easy Point`;

      for (const email of recipients) {
        await this.mailService.sendMail(email, subject, html);
        this.logger.log(`Cancellation notice sent to ${email} for subscription ${subscriptionId}.`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send cancellation emails for subscription ${subscriptionId}`, error.stack);
    }
  }

  /**
   * Resolves the set of email recipients for a given organization:
   * - The organization's own contact email (if set)
   * - The OWNER user's email (via OrganizationUser → Role → User)
   *
   * Returns deduplicated list.
   */
  private async resolveOrgAndOwner(organizationId: string): Promise<{
    organization: { id: string; name: string; email: string | null };
    ownerEmail: string | null;
    recipients: string[];
  }> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, email: true },
    });

    if (!organization) {
      return { organization: { id: organizationId, name: '', email: null }, ownerEmail: null, recipients: [] };
    }

    // Find the user with OWNER role in this organization
    const ownerMembership = await this.prisma.organizationUser.findFirst({
      where: {
        organizationId,
        role: {
          name: 'OWNER',
        },
      },
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    const ownerEmail = ownerMembership?.user?.email ?? null;

    // Build deduplicated recipient list
    const emailSet = new Set<string>();
    if (organization.email) emailSet.add(organization.email);
    if (ownerEmail) emailSet.add(ownerEmail);

    return { organization, ownerEmail, recipients: [...emailSet] };
  }
}
