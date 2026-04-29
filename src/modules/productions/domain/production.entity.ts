import { Prisma, ProductionType, ProductionStatus, UnitOfMeasure } from '@prisma/client';

export class ProductionEntity {
  readonly id: string;
  readonly organizationId: string;
  name: string;
  productionDate: Date;
  type: ProductionType;
  status: ProductionStatus;
  readonly productId: string | null;
  quantityProduced: Prisma.Decimal;
  unitOfMeasure: UnitOfMeasure;
  totalCost: Prisma.Decimal;
  notes: string | null;
  readonly performedByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    name: string;
    productionDate: Date;
    type: ProductionType;
    status: ProductionStatus;
    productId: string | null;
    quantityProduced: Prisma.Decimal;
    unitOfMeasure: UnitOfMeasure;
    totalCost: Prisma.Decimal;
    notes: string | null;
    performedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.name = params.name;
    this.productionDate = params.productionDate;
    this.type = params.type;
    this.status = params.status;
    this.productId = params.productId;
    this.quantityProduced = params.quantityProduced;
    this.unitOfMeasure = params.unitOfMeasure;
    this.totalCost = params.totalCost;
    this.notes = params.notes;
    this.performedByUserId = params.performedByUserId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  isSellable(): boolean {
    return this.type === ProductionType.SELLABLE;
  }

  isCompleted(): boolean {
    return this.status === ProductionStatus.COMPLETED;
  }

  canComplete(): boolean {
    return this.status === ProductionStatus.DRAFT;
  }

  canCancel(): boolean {
    return this.status === ProductionStatus.DRAFT;
  }

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    name: string;
    productionDate: Date;
    type: ProductionType;
    status: ProductionStatus;
    productId: string | null;
    quantityProduced: Prisma.Decimal;
    unitOfMeasure: UnitOfMeasure;
    totalCost: Prisma.Decimal;
    notes: string | null;
    performedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProductionEntity {
    return new ProductionEntity({
      id: raw.id,
      organizationId: raw.organizationId,
      name: raw.name,
      productionDate: raw.productionDate,
      type: raw.type,
      status: raw.status,
      productId: raw.productId,
      quantityProduced: raw.quantityProduced,
      unitOfMeasure: raw.unitOfMeasure,
      totalCost: raw.totalCost,
      notes: raw.notes,
      performedByUserId: raw.performedByUserId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
