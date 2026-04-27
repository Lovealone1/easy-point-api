import { SaleStatus, Prisma } from '@prisma/client';

export class SaleEntity {
  readonly id: string;
  readonly organizationId: string;
  readonly clientId: string | null;
  readonly totalAmount: Prisma.Decimal;
  readonly transactionId: string | null;
  readonly status: SaleStatus;
  readonly notes: string | null;
  readonly performedByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    clientId: string | null;
    totalAmount: Prisma.Decimal;
    transactionId: string | null;
    status: SaleStatus;
    notes: string | null;
    performedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.clientId = params.clientId;
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
    clientId: string | null;
    totalAmount: Prisma.Decimal;
    transactionId: string | null;
    status: SaleStatus;
    notes: string | null;
    performedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SaleEntity {
    return new SaleEntity(raw);
  }
}
