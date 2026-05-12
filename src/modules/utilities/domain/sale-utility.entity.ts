import { Prisma } from '@prisma/client';
import { SaleItemUtilityEntity } from './sale-item-utility.entity.js';

export class SaleUtilityEntity {
  readonly id: string;
  readonly organizationId: string;
  readonly saleId: string;
  readonly totalRevenue: Prisma.Decimal;
  readonly totalCost: Prisma.Decimal;
  readonly grossProfit: Prisma.Decimal;
  readonly marginPercent: Prisma.Decimal;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  items?: SaleItemUtilityEntity[];

  constructor(params: {
    id: string;
    organizationId: string;
    saleId: string;
    totalRevenue: Prisma.Decimal;
    totalCost: Prisma.Decimal;
    grossProfit: Prisma.Decimal;
    marginPercent: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
    items?: SaleItemUtilityEntity[];
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.saleId = params.saleId;
    this.totalRevenue = params.totalRevenue;
    this.totalCost = params.totalCost;
    this.grossProfit = params.grossProfit;
    this.marginPercent = params.marginPercent;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
    this.items = params.items;
  }

  // ─── Business logic ────────────────────────────────────────────────────────

  /**
   * Aggregates an array of computed items to produce the sale-level totals.
   * This is the single source of truth for margin calculation.
   */
  static aggregateFromItems(
    organizationId: string,
    saleId: string,
    items: Array<{
      totalRevenue: Prisma.Decimal;
      totalCost: Prisma.Decimal;
      grossProfit: Prisma.Decimal;
    }>,
  ): { totalRevenue: Prisma.Decimal; totalCost: Prisma.Decimal; grossProfit: Prisma.Decimal; marginPercent: Prisma.Decimal } {
    const totalRevenue = items.reduce(
      (sum, i) => sum.plus(i.totalRevenue),
      new Prisma.Decimal(0),
    );
    const totalCost = items.reduce(
      (sum, i) => sum.plus(i.totalCost),
      new Prisma.Decimal(0),
    );
    const grossProfit = totalRevenue.minus(totalCost);
    const marginPercent = totalRevenue.isZero()
      ? new Prisma.Decimal(0)
      : grossProfit.div(totalRevenue).times(100);

    return { totalRevenue, totalCost, grossProfit, marginPercent };
  }

  // ─── Mapper ────────────────────────────────────────────────────────────────

  static fromPrisma(
    raw: {
      id: string;
      organizationId: string;
      saleId: string;
      totalRevenue: Prisma.Decimal;
      totalCost: Prisma.Decimal;
      grossProfit: Prisma.Decimal;
      marginPercent: Prisma.Decimal;
      createdAt: Date;
      updatedAt: Date;
      items?: Parameters<typeof SaleItemUtilityEntity.fromPrisma>[0][];
    },
  ): SaleUtilityEntity {
    return new SaleUtilityEntity({
      ...raw,
      items: raw.items?.map(SaleItemUtilityEntity.fromPrisma),
    });
  }
}
