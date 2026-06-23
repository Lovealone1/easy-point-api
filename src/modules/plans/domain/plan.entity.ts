import { Prisma } from '@prisma/client';

export class PlanEntity {
  readonly id: string;
  name: string;
  description: string | null;
  monthlyPrice: Prisma.Decimal;
  yearlyPrice: Prisma.Decimal;
  currency: string;
  isActive: boolean;
  metadata: Prisma.JsonValue | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    name: string;
    description: string | null;
    monthlyPrice: Prisma.Decimal;
    yearlyPrice: Prisma.Decimal;
    currency: string;
    isActive: boolean;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.monthlyPrice = params.monthlyPrice;
    this.yearlyPrice = params.yearlyPrice;
    this.currency = params.currency;
    this.isActive = params.isActive;
    this.metadata = params.metadata;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  static fromPrisma(raw: {
    id: string;
    name: string;
    description: string | null;
    monthlyPrice: Prisma.Decimal;
    yearlyPrice: Prisma.Decimal;
    currency: string;
    isActive: boolean;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }): PlanEntity {
    return new PlanEntity({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      monthlyPrice: raw.monthlyPrice,
      yearlyPrice: raw.yearlyPrice,
      currency: raw.currency,
      isActive: raw.isActive,
      metadata: raw.metadata,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
