import { Prisma, MovementType } from '@prisma/client';

export class InventoryMovementEntity {
  readonly id: string;
  readonly organizationId: string;
  readonly productId: string;
  readonly stockId: string;
  readonly quantity: number;
  readonly unitCost: number | null;
  readonly type: MovementType;
  readonly reason: string | null;
  readonly referenceId: string | null;
  readonly referenceType: string | null;
  readonly performedByUserId: string | null;
  readonly saleId: string | null;
  readonly productionId: string | null;
  readonly productName: string | null;
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
    saleId: string | null;
    productionId: string | null;
    productName?: string | null;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.productId = params.productId;
    this.stockId = params.stockId;
    this.quantity = Number(params.quantity);
    this.unitCost = params.unitCost ? Number(params.unitCost) : null;
    this.type = params.type;
    this.reason = params.reason;
    this.referenceId = params.referenceId;
    this.referenceType = params.referenceType;
    this.performedByUserId = params.performedByUserId;
    this.saleId = params.saleId;
    this.productionId = params.productionId;
    this.productName = params.productName ?? null;
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
    saleId: string | null;
    productionId: string | null;
    createdAt: Date;
    product?: { name: string } | null;
  }): InventoryMovementEntity {
    return new InventoryMovementEntity({
      ...raw,
      productName: raw.product?.name ?? null,
    });
  }
}
