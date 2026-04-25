import { Prisma, MovementType } from '@prisma/client';

export class InventoryMovementEntity {
  readonly id: string;
  readonly organizationId: string;
  readonly productId: string;
  readonly stockId: string;
  readonly quantity: Prisma.Decimal;
  readonly unitCost: Prisma.Decimal | null;
  readonly type: MovementType;
  readonly reason: string | null;
  readonly referenceId: string | null;
  readonly referenceType: string | null;
  readonly performedByUserId: string | null;
  readonly createdAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    productId: string;
    stockId: string;
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal | null;
    type: MovementType;
    reason: string | null;
    referenceId: string | null;
    referenceType: string | null;
    performedByUserId: string | null;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.productId = params.productId;
    this.stockId = params.stockId;
    this.quantity = params.quantity;
    this.unitCost = params.unitCost;
    this.type = params.type;
    this.reason = params.reason;
    this.referenceId = params.referenceId;
    this.referenceType = params.referenceType;
    this.performedByUserId = params.performedByUserId;
    this.createdAt = params.createdAt;
  }

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    productId: string;
    stockId: string;
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal | null;
    type: MovementType;
    reason: string | null;
    referenceId: string | null;
    referenceType: string | null;
    performedByUserId: string | null;
    createdAt: Date;
  }): InventoryMovementEntity {
    return new InventoryMovementEntity({
      id: raw.id,
      organizationId: raw.organizationId,
      productId: raw.productId,
      stockId: raw.stockId,
      quantity: raw.quantity,
      unitCost: raw.unitCost,
      type: raw.type,
      reason: raw.reason,
      referenceId: raw.referenceId,
      referenceType: raw.referenceType,
      performedByUserId: raw.performedByUserId,
      createdAt: raw.createdAt,
    });
  }
}
