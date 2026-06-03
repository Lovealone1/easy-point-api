import { Prisma, SupplyMovementType } from '@prisma/client';

export class SupplyMovementEntity {
  readonly id: string;
  readonly organizationId: string;
  readonly supplyId: string;
  readonly stockId: string;
  readonly quantity: Prisma.Decimal;
  readonly unitCost: Prisma.Decimal | null;
  readonly type: SupplyMovementType;
  readonly reason: string | null;
  readonly referenceId: string | null;
  readonly referenceType: string | null;
  readonly performedByUserId: string | null;
  readonly supplyPurchaseId: string | null;
  readonly productionId: string | null;
  readonly supplyName: string | null;
  readonly createdAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    supplyId: string;
    stockId: string;
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal | null;
    type: SupplyMovementType;
    reason: string | null;
    referenceId: string | null;
    referenceType: string | null;
    performedByUserId: string | null;
    supplyPurchaseId: string | null;
    productionId: string | null;
    supplyName?: string | null;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.supplyId = params.supplyId;
    this.stockId = params.stockId;
    this.quantity = params.quantity;
    this.unitCost = params.unitCost;
    this.type = params.type;
    this.reason = params.reason;
    this.referenceId = params.referenceId;
    this.referenceType = params.referenceType;
    this.performedByUserId = params.performedByUserId;
    this.supplyPurchaseId = params.supplyPurchaseId;
    this.productionId = params.productionId;
    this.supplyName = params.supplyName ?? null;
    this.createdAt = params.createdAt;
  }

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    supplyId: string;
    stockId: string;
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal | null;
    type: SupplyMovementType;
    reason: string | null;
    referenceId: string | null;
    referenceType: string | null;
    performedByUserId: string | null;
    supplyPurchaseId: string | null;
    productionId: string | null;
    createdAt: Date;
    supply?: { name: string } | null;
  }): SupplyMovementEntity {
    return new SupplyMovementEntity({
      ...raw,
      supplyName: raw.supply?.name ?? null,
    });
  }
}
