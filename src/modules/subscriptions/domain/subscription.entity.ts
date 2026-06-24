import { Prisma, BillingCycle, SubscriptionStatus } from '@prisma/client';
import { PlanEntity } from '../../plans/domain/plan.entity.js';

export class SubscriptionEntity {
  readonly id: string;
  organizationId: string;
  planId: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  cancelledAt: Date | null;
  isPaused: boolean;
  pausedAt: Date | null;
  notes: string | null;
  metadata: Prisma.JsonValue | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  // Optional relations
  plan?: PlanEntity;

  constructor(params: {
    id: string;
    organizationId: string;
    planId: string;
    billingCycle: BillingCycle;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEndsAt: Date | null;
    cancelledAt: Date | null;
    isPaused: boolean;
    pausedAt: Date | null;
    notes: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    plan?: PlanEntity;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.planId = params.planId;
    this.billingCycle = params.billingCycle;
    this.status = params.status;
    this.currentPeriodStart = params.currentPeriodStart;
    this.currentPeriodEnd = params.currentPeriodEnd;
    this.trialEndsAt = params.trialEndsAt;
    this.cancelledAt = params.cancelledAt;
    this.isPaused = params.isPaused;
    this.pausedAt = params.pausedAt;
    this.notes = params.notes;
    this.metadata = params.metadata;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
    if (params.plan) {
      this.plan = params.plan;
    }
  }

  static fromPrisma(raw: any): SubscriptionEntity {
    return new SubscriptionEntity({
      id: raw.id,
      organizationId: raw.organizationId,
      planId: raw.planId,
      billingCycle: raw.billingCycle,
      status: raw.status,
      currentPeriodStart: raw.currentPeriodStart,
      currentPeriodEnd: raw.currentPeriodEnd,
      trialEndsAt: raw.trialEndsAt,
      cancelledAt: raw.cancelledAt,
      isPaused: raw.isPaused,
      pausedAt: raw.pausedAt,
      notes: raw.notes,
      metadata: raw.metadata,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      plan: raw.plan ? PlanEntity.fromPrisma(raw.plan) : undefined,
    });
  }
}
