import { SubscriptionStatus } from '@prisma/client';

/**
 * Single source of truth for turning "an organization's most recent
 * subscription row" into the plan/access facts every read model needs
 * (OrganizationEntity, OrganizationConfigEntity, auth.service#getProfile).
 *
 * Mirrors the access rule enforced by SubscriptionAccessGuard: a
 * subscription grants access while ACTIVE or TRIALING and its period
 * hasn't lapsed. Callers must pass the LATEST subscription regardless of
 * status (not pre-filtered to ACTIVE/TRIALING) so an expired trial still
 * resolves to accessBlocked: true instead of silently looking like a
 * brand-new FREE org.
 */
export interface SubscriptionState {
  plan: string;
  planActiveUntil: Date | null;
  subscriptionStatus: SubscriptionStatus | null;
  isTrial: boolean;
  trialEndsAt: Date | null;
  trialDaysRemaining: number | null;
  accessBlocked: boolean;
}

export type SubscriptionLike = {
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  plan: { name: string };
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveSubscriptionState(
  subscription: SubscriptionLike | null | undefined,
): SubscriptionState {
  if (!subscription) {
    // No subscription row at all — fail open, same default the guard uses
    // for orgs created before this feature existed.
    return {
      plan: 'FREE',
      planActiveUntil: null,
      subscriptionStatus: null,
      isTrial: false,
      trialEndsAt: null,
      trialDaysRemaining: null,
      accessBlocked: false,
    };
  }

  const planName = subscription.plan.name.toUpperCase();
  const isTrial = planName === 'FREE';
  const hasAccess =
    (subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.TRIALING) &&
    subscription.currentPeriodEnd >= new Date();

  let trialDaysRemaining: number | null = null;
  if (isTrial && subscription.trialEndsAt) {
    const msRemaining = subscription.trialEndsAt.getTime() - Date.now();
    trialDaysRemaining = Math.max(0, Math.ceil(msRemaining / DAY_MS));
  }

  return {
    plan: planName,
    planActiveUntil: subscription.currentPeriodEnd,
    subscriptionStatus: subscription.status,
    isTrial,
    trialEndsAt: subscription.trialEndsAt,
    trialDaysRemaining,
    accessBlocked: !hasAccess,
  };
}
