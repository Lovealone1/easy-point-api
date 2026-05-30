import { SaleStatus, Prisma } from '@prisma/client';

export class SaleEntity {
  readonly id: string;
  readonly organizationId: string;
  readonly clientId: string | null;
  readonly clientName: string | null;
  readonly subtotalAmount: number | null;
  readonly discountAmount: number | null;
  readonly totalAmount: number;
  readonly transactionId: string | null;
  readonly status: SaleStatus;
  readonly notes: string | null;
  readonly performedByUserId: string | null;
  readonly performedByUserEmail: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    clientId: string | null;
    clientName?: string | null;
    subtotalAmount: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal | null;
    totalAmount: Prisma.Decimal;
    transactionId: string | null;
    status: SaleStatus;
    notes: string | null;
    performedByUserId: string | null;
    performedByUserEmail?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.clientId = params.clientId;
    this.clientName = params.clientName ?? null;
    this.subtotalAmount = params.subtotalAmount ? Number(params.subtotalAmount) as any : null;
    this.discountAmount = params.discountAmount ? Number(params.discountAmount) as any : null;
    this.totalAmount = Number(params.totalAmount) as any;
    this.transactionId = params.transactionId;
    this.status = params.status;
    this.notes = params.notes;
    this.performedByUserId = params.performedByUserId;
    this.performedByUserEmail = params.performedByUserEmail ?? null;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    clientId: string | null;
    subtotalAmount: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal | null;
    totalAmount: Prisma.Decimal;
    transactionId: string | null;
    status: SaleStatus;
    notes: string | null;
    performedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    client?: { name: string } | null;
    performedBy?: { email: string } | null;
  }): SaleEntity {
    return new SaleEntity({
      ...raw,
      clientName: raw.client?.name ?? null,
      performedByUserEmail: raw.performedBy?.email ?? null,
    });
  }
}

