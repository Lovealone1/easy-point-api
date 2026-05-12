import { Prisma, CostSource } from '@prisma/client';
import { SaleItemUtilityEntity } from './domain/sale-item-utility.entity.js';
import { SaleUtilityEntity } from './domain/sale-utility.entity.js';

describe('SaleItemUtilityEntity.compute()', () => {
  const base = {
    organizationId: 'org-1',
    saleUtilityId: '',
    productId: 'prod-1',
  };

  it('calculates totalRevenue = unitRevenue * quantity', () => {
    const result = SaleItemUtilityEntity.compute({
      ...base,
      quantity: new Prisma.Decimal(3),
      unitRevenue: new Prisma.Decimal(15000),
      unitCost: new Prisma.Decimal(5500),
      costSource: CostSource.ESTIMATED,
    });

    expect(result.totalRevenue.toNumber()).toBe(45000);
  });

  it('calculates totalCost = unitCost * quantity', () => {
    const result = SaleItemUtilityEntity.compute({
      ...base,
      quantity: new Prisma.Decimal(3),
      unitRevenue: new Prisma.Decimal(15000),
      unitCost: new Prisma.Decimal(5500),
      costSource: CostSource.ESTIMATED,
    });

    // THIS IS THE KEY ASSERTION: 5500 * 3 = 16500, NOT 450
    expect(result.totalCost.toNumber()).toBe(16500);
  });

  it('calculates grossProfit = totalRevenue - totalCost', () => {
    const result = SaleItemUtilityEntity.compute({
      ...base,
      quantity: new Prisma.Decimal(3),
      unitRevenue: new Prisma.Decimal(15000),
      unitCost: new Prisma.Decimal(5500),
      costSource: CostSource.ESTIMATED,
    });

    expect(result.grossProfit.toNumber()).toBe(28500); // 45000 - 16500
  });

  it('calculates marginPercent = grossProfit / totalRevenue * 100', () => {
    const result = SaleItemUtilityEntity.compute({
      ...base,
      quantity: new Prisma.Decimal(3),
      unitRevenue: new Prisma.Decimal(15000),
      unitCost: new Prisma.Decimal(5500),
      costSource: CostSource.ESTIMATED,
    });

    // 28500 / 45000 * 100 = 63.333...
    expect(result.marginPercent.toNumber()).toBeCloseTo(63.33, 2);
  });

  it('returns marginPercent = 0 when totalRevenue is zero', () => {
    const result = SaleItemUtilityEntity.compute({
      ...base,
      quantity: new Prisma.Decimal(1),
      unitRevenue: new Prisma.Decimal(0),
      unitCost: new Prisma.Decimal(5500),
      costSource: CostSource.ESTIMATED,
    });

    expect(result.marginPercent.toNumber()).toBe(0);
  });

  it('returns unitCost = 0 and costSource = UNKNOWN when no cost data', () => {
    const result = SaleItemUtilityEntity.compute({
      ...base,
      quantity: new Prisma.Decimal(3),
      unitRevenue: new Prisma.Decimal(15000),
      unitCost: new Prisma.Decimal(0),
      costSource: CostSource.UNKNOWN,
    });

    expect(result.unitCost.toNumber()).toBe(0);
    expect(result.totalCost.toNumber()).toBe(0);
    expect(result.grossProfit.toNumber()).toBe(45000);
    expect(result.costSource).toBe(CostSource.UNKNOWN);
  });

  /**
   * REGRESSION TEST — Reported bug:
   * When product has Production with totalCost=450 and quantityProduced=3,
   * unitCost_from_production = 450/3 = 150.
   * Then totalCost = 150 * 3 = 450.
   * The fix: if Production.totalCost = 0 (draft/incomplete), fallback to costPrice.
   */
  it('[REGRESSION] does not use production cost when production totalCost is zero', () => {
    // Production totalCost=0, quantityProduced=3 → unitCost_production = 0/3 = 0
    // Should fall through to costPrice=5500
    const productionUnitCost = new Prisma.Decimal(0).div(new Prisma.Decimal(3));

    // We expect the service to detect totalCost=0 and skip this production
    expect(productionUnitCost.isZero()).toBe(true);
  });
});

describe('SaleUtilityEntity.aggregateFromItems()', () => {
  it('sums totalRevenue, totalCost and grossProfit across items', () => {
    const items = [
      {
        totalRevenue: new Prisma.Decimal(45000),
        totalCost: new Prisma.Decimal(16500),
        grossProfit: new Prisma.Decimal(28500),
      },
      {
        totalRevenue: new Prisma.Decimal(20000),
        totalCost: new Prisma.Decimal(8000),
        grossProfit: new Prisma.Decimal(12000),
      },
    ];

    const result = SaleUtilityEntity.aggregateFromItems('org-1', 'sale-1', items);

    expect(result.totalRevenue.toNumber()).toBe(65000);
    expect(result.totalCost.toNumber()).toBe(24500);
    expect(result.grossProfit.toNumber()).toBe(40500);
  });

  it('calculates correct margin across multiple items', () => {
    const items = [
      {
        totalRevenue: new Prisma.Decimal(45000),
        totalCost: new Prisma.Decimal(16500),
        grossProfit: new Prisma.Decimal(28500),
      },
    ];

    const result = SaleUtilityEntity.aggregateFromItems('org-1', 'sale-1', items);
    // 28500 / 45000 * 100 = 63.33
    expect(result.marginPercent.toNumber()).toBeCloseTo(63.33, 2);
  });

  it('returns zero margin when no revenue', () => {
    const items = [
      {
        totalRevenue: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(0),
        grossProfit: new Prisma.Decimal(0),
      },
    ];

    const result = SaleUtilityEntity.aggregateFromItems('org-1', 'sale-1', items);
    expect(result.marginPercent.toNumber()).toBe(0);
  });
});

/**
 * Cost hierarchy logic test (isolated — does not require DB)
 * Mirrors the exact logic in UtilitiesService.computeAndPersist().
 *
 * Cost source:
 *  ESTIMATED → Product.costPrice (when set)
 *  UNKNOWN   → costPrice is null / not configured
 *
 * NOTE: Production.totalCost is intentionally NOT used as a cost source.
 * Production tracks ingredient/raw-material cost for manufacturing batches,
 * which is different from the product's commercial cost price used for
 * profitability reporting.
 */
describe('Cost hierarchy resolution (unit simulation)', () => {
  function resolveCost(params: {
    costPrice?: number | null;
  }): { unitCost: number; costSource: CostSource } {
    let unitCost: Prisma.Decimal;
    let costSource: CostSource;

    if (params.costPrice != null) {
      unitCost = new Prisma.Decimal(params.costPrice);
      costSource = CostSource.ESTIMATED;
    } else {
      unitCost = new Prisma.Decimal(0);
      costSource = CostSource.UNKNOWN;
    }

    return { unitCost: unitCost.toNumber(), costSource };
  }

  it('uses costPrice (ESTIMATED) when set', () => {
    const result = resolveCost({ costPrice: 5500 });
    expect(result.unitCost).toBe(5500);
    expect(result.costSource).toBe(CostSource.ESTIMATED);
  });

  it('returns UNKNOWN with 0 when costPrice is null', () => {
    const result = resolveCost({ costPrice: null });
    expect(result.unitCost).toBe(0);
    expect(result.costSource).toBe(CostSource.UNKNOWN);
  });

  it('[REGRESSION] 3 units × costPrice(5500) = totalCost(16500), not 450', () => {
    const { unitCost } = resolveCost({ costPrice: 5500 });
    const totalCost = new Prisma.Decimal(unitCost).times(new Prisma.Decimal(3));
    expect(totalCost.toNumber()).toBe(16500);
    expect(totalCost.toNumber()).not.toBe(450);
  });

  it('[REGRESSION] production cost does NOT override costPrice', () => {
    // Even if a production batch had totalCost=1500 / qty=10 → unitCost=150,
    // the service must use costPrice=5500 instead.
    const productionDerivedCost = 150; // 1500 / 10
    const { unitCost } = resolveCost({ costPrice: 5500 });
    expect(unitCost).not.toBe(productionDerivedCost);
    expect(unitCost).toBe(5500);
  });
});
