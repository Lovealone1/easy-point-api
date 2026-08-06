import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_SUBSCRIPTION_KEY = 'allow_without_subscription';

/**
 * Exempts a controller/route from SubscriptionAccessGuard. Use on routes
 * that must remain reachable even when the organization's trial/subscription
 * has expired: auth, self-service org creation, reading plans, the caller's
 * own subscription status, and anything the trial-expired page needs to render.
 *
 * Uso:
 * @AllowWithoutSubscription()
 */
export const AllowWithoutSubscription = () =>
  SetMetadata(ALLOW_WITHOUT_SUBSCRIPTION_KEY, true);
