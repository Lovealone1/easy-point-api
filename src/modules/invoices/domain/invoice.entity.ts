import { Prisma, InvoiceStatus } from '@prisma/client';
import { SubscriptionEntity } from '../../subscriptions/domain/subscription.entity.js';

export class InvoiceEntity {
  readonly id: string;
  organizationId: string;
  subscriptionId: string;
  invoiceNumber: string;
  amount: Prisma.Decimal;
  currency: string;
  status: InvoiceStatus;
  dueDate: Date;
  paidAt: Date | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  paymentNotes: string | null;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  metadata: Prisma.JsonValue | null;
  notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  // Optional relations
  subscription?: SubscriptionEntity;

  constructor(params: {
    id: string;
    organizationId: string;
    subscriptionId: string;
    invoiceNumber: string;
    amount: Prisma.Decimal;
    currency: string;
    status: InvoiceStatus;
    dueDate: Date;
    paidAt: Date | null;
    paymentReference: string | null;
    paymentMethod: string | null;
    paymentNotes: string | null;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    metadata: Prisma.JsonValue | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    subscription?: SubscriptionEntity;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.subscriptionId = params.subscriptionId;
    this.invoiceNumber = params.invoiceNumber;
    this.amount = params.amount;
    this.currency = params.currency;
    this.status = params.status;
    this.dueDate = params.dueDate;
    this.paidAt = params.paidAt;
    this.paymentReference = params.paymentReference;
    this.paymentMethod = params.paymentMethod;
    this.paymentNotes = params.paymentNotes;
    this.billingPeriodStart = params.billingPeriodStart;
    this.billingPeriodEnd = params.billingPeriodEnd;
    this.metadata = params.metadata;
    this.notes = params.notes;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
    if (params.subscription) {
      this.subscription = params.subscription;
    }
  }

  static fromPrisma(raw: any): InvoiceEntity {
    return new InvoiceEntity({
      id: raw.id,
      organizationId: raw.organizationId,
      subscriptionId: raw.subscriptionId,
      invoiceNumber: raw.invoiceNumber,
      amount: raw.amount,
      currency: raw.currency,
      status: raw.status,
      dueDate: raw.dueDate,
      paidAt: raw.paidAt,
      paymentReference: raw.paymentReference,
      paymentMethod: raw.paymentMethod,
      paymentNotes: raw.paymentNotes,
      billingPeriodStart: raw.billingPeriodStart,
      billingPeriodEnd: raw.billingPeriodEnd,
      metadata: raw.metadata,
      notes: raw.notes,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      subscription: raw.subscription ? SubscriptionEntity.fromPrisma(raw.subscription) : undefined,
    });
  }
}
