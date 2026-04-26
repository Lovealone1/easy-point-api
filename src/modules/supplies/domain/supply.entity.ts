import { Prisma, UnitOfMeasure } from '@prisma/client';


export class SupplyEntity {
  readonly id: string;
  name: string;
  description: string | null;
  unitOfMeasure: UnitOfMeasure;
  basePrice: Prisma.Decimal;
  packageSize: Prisma.Decimal;
  pricePerUnit: Prisma.Decimal;
  isActive: boolean;
  notes: string | null;
  readonly organizationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    name: string;
    description: string | null;
    unitOfMeasure: UnitOfMeasure;
    basePrice: Prisma.Decimal;
    packageSize: Prisma.Decimal;
    pricePerUnit: Prisma.Decimal;
    isActive: boolean;
    notes: string | null;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.unitOfMeasure = params.unitOfMeasure;
    this.basePrice = params.basePrice;
    this.packageSize = params.packageSize;
    this.pricePerUnit = params.pricePerUnit;
    this.isActive = params.isActive;
    this.notes = params.notes;
    this.organizationId = params.organizationId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }



  applyPriceChange(
    newBasePrice?: Prisma.Decimal,
    newPackageSize?: Prisma.Decimal,
  ): void {
    if (newBasePrice !== undefined) this.basePrice = newBasePrice;
    if (newPackageSize !== undefined) this.packageSize = newPackageSize;
    this.pricePerUnit = this.basePrice.div(this.packageSize);
  }

  appendNote(note: string): void {
    this.notes = this.notes ? `${this.notes}\n${note}` : note;
  }

  static fromPrisma(raw: {
    id: string;
    name: string;
    description: string | null;
    unitOfMeasure: UnitOfMeasure;
    basePrice: Prisma.Decimal;
    packageSize: Prisma.Decimal;
    pricePerUnit: Prisma.Decimal;
    isActive: boolean;
    notes: string | null;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): SupplyEntity {
    return new SupplyEntity({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      unitOfMeasure: raw.unitOfMeasure,
      basePrice: raw.basePrice,
      packageSize: raw.packageSize,
      pricePerUnit: raw.pricePerUnit,
      isActive: raw.isActive,
      notes: raw.notes,
      organizationId: raw.organizationId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
