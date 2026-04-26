import { Prisma } from '@prisma/client';

export class ProductStockEntity {
  readonly id: string;
  readonly organizationId: string;
  readonly productId: string;
  location: string;
  quantity: Prisma.Decimal;
  minQuantity: Prisma.Decimal;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    productId: string;
    location: string;
    quantity: Prisma.Decimal;
    minQuantity: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.productId = params.productId;
    this.location = params.location;
    this.quantity = params.quantity;
    this.minQuantity = params.minQuantity;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  // Lógica de negocio
  applyMovement(amount: Prisma.Decimal | number, type: 'ADD' | 'SUBTRACT'): void {
    const decAmount = new Prisma.Decimal(amount);
    if (type === 'ADD') {
      this.quantity = this.quantity.plus(decAmount);
    } else if (type === 'SUBTRACT') {
      this.quantity = this.quantity.minus(decAmount);
    }
  }

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    productId: string;
    location: string;
    quantity: Prisma.Decimal;
    minQuantity: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }): ProductStockEntity {
    return new ProductStockEntity({
      id: raw.id,
      organizationId: raw.organizationId,
      productId: raw.productId,
      location: raw.location,
      quantity: raw.quantity,
      minQuantity: raw.minQuantity,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
