import { BillingCycle, Prisma, UserSubscriptionStatus } from '@prisma/client';
import { SubscriptionProviderEntity } from '../../subscription-catalog/domain/subscription-provider.entity.js';
import { SubscriptionCategoryEntity } from '../../subscription-catalog/domain/subscription-category.entity.js';
import { UserPaymentCardEntity } from '../../user-payment-cards/domain/user-payment-card.entity.js';

export class UserSubscriptionEntity {
  readonly id: string;
  readonly userId: string;
  providerId: string | null;
  customName: string | null;
  customLogoUrl: string | null;
  customCategoryId: string | null;
  cardId: string | null;
  planLabel: string | null;
  amount: Prisma.Decimal;
  currency: string;
  billingCycle: BillingCycle;
  startedAt: Date;
  nextBillingDate: Date | null;
  status: UserSubscriptionStatus;
  isTrial: boolean;
  trialEndsAt: Date | null;
  cancelledAt: Date | null;
  notes: string | null;
  metadata: Prisma.JsonValue | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  provider?: SubscriptionProviderEntity | null;
  customCategory?: SubscriptionCategoryEntity | null;
  card?: UserPaymentCardEntity | null;

  constructor(params: {
    id: string;
    userId: string;
    providerId: string | null;
    customName: string | null;
    customLogoUrl: string | null;
    customCategoryId: string | null;
    cardId: string | null;
    planLabel: string | null;
    amount: Prisma.Decimal;
    currency: string;
    billingCycle: BillingCycle;
    startedAt: Date;
    nextBillingDate: Date | null;
    status: UserSubscriptionStatus;
    isTrial: boolean;
    trialEndsAt: Date | null;
    cancelledAt: Date | null;
    notes: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    provider?: SubscriptionProviderEntity | null;
    customCategory?: SubscriptionCategoryEntity | null;
    card?: UserPaymentCardEntity | null;
  }) {
    Object.assign(this, params);
  }

  /** Unified display name — resolves catalog vs. custom subscriptions so the UI never branches. */
  get displayName(): string {
    return this.provider?.name ?? this.customName ?? 'Suscripción';
  }

  get displayLogoUrl(): string | null {
    return this.provider?.logoUrl ?? this.customLogoUrl ?? null;
  }

  get displayCategory(): SubscriptionCategoryEntity | null {
    return this.provider?.category ?? this.customCategory ?? null;
  }

  static fromPrisma(raw: {
    id: string;
    userId: string;
    providerId: string | null;
    customName: string | null;
    customLogoUrl: string | null;
    customCategoryId: string | null;
    cardId: string | null;
    planLabel: string | null;
    amount: Prisma.Decimal;
    currency: string;
    billingCycle: BillingCycle;
    startedAt: Date;
    nextBillingDate: Date | null;
    status: UserSubscriptionStatus;
    isTrial: boolean;
    trialEndsAt: Date | null;
    cancelledAt: Date | null;
    notes: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    provider?: Parameters<typeof SubscriptionProviderEntity.fromPrisma>[0] | null;
    customCategory?: Parameters<typeof SubscriptionCategoryEntity.fromPrisma>[0] | null;
    card?: Parameters<typeof UserPaymentCardEntity.fromPrisma>[0] | null;
  }): UserSubscriptionEntity {
    return new UserSubscriptionEntity({
      ...raw,
      provider: raw.provider ? SubscriptionProviderEntity.fromPrisma(raw.provider) : null,
      customCategory: raw.customCategory ? SubscriptionCategoryEntity.fromPrisma(raw.customCategory) : null,
      card: raw.card ? UserPaymentCardEntity.fromPrisma(raw.card) : null,
    });
  }
}
