import { Prisma, CostSource } from '@prisma/client';

export class SaleItemUtilityEntity {
  readonly id: string;
  readonly organizationId: string;
  readonly saleUtilityId: string;
  readonly productId: string;
  readonly quantity: Prisma.Decimal;
  readonly unitRevenue: Prisma.Decimal;
  readonly unitCost: Prisma.Decimal;
  readonly totalRevenue: Prisma.Decimal;
  readonly totalCost: Prisma.Decimal;
  readonly grossProfit: Prisma.Decimal;
  readonly marginPercent: Prisma.Decimal;
  readonly costSource: CostSource;
  readonly createdAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    saleUtilityId: string;
    productId: string;
    quantity: Prisma.Decimal;
    unitRevenue: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    totalRevenue: Prisma.Decimal;
    totalCost: Prisma.Decimal;
    grossProfit: Prisma.Decimal;
    marginPercent: Prisma.Decimal;
    costSource: CostSource;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.saleUtilityId = params.saleUtilityId;
    this.productId = params.productId;
    this.quantity = params.quantity;
    this.unitRevenue = params.unitRevenue;
    this.unitCost = params.unitCost;
    this.totalRevenue = params.totalRevenue;
    this.totalCost = params.totalCost;
    this.grossProfit = params.grossProfit;
    this.marginPercent = params.marginPercent;
    this.costSource = params.costSource;
    this.createdAt = params.createdAt;
  }

  // ─── Business logic ────────────────────────────────────────────────────────

  /**
   * Calculates all derived fields from unitRevenue, unitCost, quantity.
   * Must be called before persisting.
   */
  static compute(params: {
    organizationId: string;
    saleUtilityId: string;
    productId: string;
    quantity: Prisma.Decimal;
    unitRevenue: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    costSource: CostSource;
  }): Omit<SaleItemUtilityEntity, 'id' | 'createdAt'> & { id: undefined; createdAt: undefined } {
    const totalRevenue = params.unitRevenue.times(params.quantity);
    const totalCost = params.unitCost.times(params.quantity);
    const grossProfit = totalRevenue.minus(totalCost);
    const marginPercent = totalRevenue.isZero()
      ? new Prisma.Decimal(0)
      : grossProfit.div(totalRevenue).times(100);

    return {
      id: undefined,
      createdAt: undefined,
      organizationId: params.organizationId,
      saleUtilityId: params.saleUtilityId,
      productId: params.productId,
      quantity: params.quantity,
      unitRevenue: params.unitRevenue,
      unitCost: params.unitCost,
      totalRevenue,
      totalCost,
      grossProfit,
      marginPercent,
      costSource: params.costSource,
    };
  }

  // ─── Mapper ────────────────────────────────────────────────────────────────

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    saleUtilityId: string;
    productId: string;
    quantity: Prisma.Decimal;
    unitRevenue: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    totalRevenue: Prisma.Decimal;
    totalCost: Prisma.Decimal;
    grossProfit: Prisma.Decimal;
    marginPercent: Prisma.Decimal;
    costSource: CostSource;
    createdAt: Date;
  }): SaleItemUtilityEntity {
    return new SaleItemUtilityEntity(raw);
  }
}
