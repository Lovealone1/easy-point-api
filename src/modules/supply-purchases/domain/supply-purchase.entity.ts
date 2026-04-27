import { PurchaseStatus, Prisma } from '@prisma/client';

export class SupplyPurchaseEntity {
  readonly id: string;
  readonly organizationId: string;
  readonly supplierId: string | null;
  readonly totalAmount: Prisma.Decimal;
  readonly transactionId: string | null;
  readonly status: PurchaseStatus;
  readonly notes: string | null;
  readonly performedByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    supplierId: string | null;
    totalAmount: Prisma.Decimal;
    transactionId: string | null;
    status: PurchaseStatus;
    notes: string | null;
    performedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.supplierId = params.supplierId;
    this.totalAmount = params.totalAmount;
    this.transactionId = params.transactionId;
    this.status = params.status;
    this.notes = params.notes;
    this.performedByUserId = params.performedByUserId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    supplierId: string | null;
    totalAmount: Prisma.Decimal;
    transactionId: string | null;
    status: PurchaseStatus;
    notes: string | null;
    performedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SupplyPurchaseEntity {
    return new SupplyPurchaseEntity(raw);
  }
}
