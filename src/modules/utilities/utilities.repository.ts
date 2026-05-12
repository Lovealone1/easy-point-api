import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, CostSource } from '@prisma/client';
import { SaleUtilityEntity } from './domain/sale-utility.entity.js';
import { SaleItemUtilityEntity } from './domain/sale-item-utility.entity.js';

/** Shape returned by groupBy product queries */
export interface ProductUtilityRow {
  productId: string;
  productName: string;
  categoryId: string | null;
  categoryName: string | null;
  unitsSold: Prisma.Decimal;
  totalRevenue: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
  marginPercent: Prisma.Decimal;
}

/** Shape returned by groupBy category queries */
export interface CategoryUtilityRow {
  categoryId: string | null;
  categoryName: string | null;
  unitsSold: Prisma.Decimal;
  totalRevenue: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
  marginPercent: Prisma.Decimal;
}

/** Summary shape */
export interface UtilitySummary {
  totalRevenue: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
  marginPercent: Prisma.Decimal;
  salesCount: number;
  period: { from: string | null; to: string | null };
}

@Injectable()
export class UtilitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Write (called within SalesService transaction) ─────────────────────────

  /**
   * Persists a SaleUtility and its SaleItemUtility lines atomically.
   * Must always be called with an outer tx.
   */
  async createForSale(
    params: {
      organizationId: string;
      saleId: string;
      totalRevenue: Prisma.Decimal;
      totalCost: Prisma.Decimal;
      grossProfit: Prisma.Decimal;
      marginPercent: Prisma.Decimal;
      items: Array<{
        productId: string;
        quantity: Prisma.Decimal;
        unitRevenue: Prisma.Decimal;
        unitCost: Prisma.Decimal;
        totalRevenue: Prisma.Decimal;
        totalCost: Prisma.Decimal;
        grossProfit: Prisma.Decimal;
        marginPercent: Prisma.Decimal;
        costSource: CostSource;
      }>;
    },
    tx: Prisma.TransactionClient,
  ): Promise<SaleUtilityEntity> {
    const saleUtility = await tx.saleUtility.create({
      data: {
        organizationId: params.organizationId,
        saleId: params.saleId,
        totalRevenue: params.totalRevenue,
        totalCost: params.totalCost,
        grossProfit: params.grossProfit,
        marginPercent: params.marginPercent,
      },
    });

    if (params.items.length > 0) {
      await tx.saleItemUtility.createMany({
        data: params.items.map((item) => ({
          organizationId: params.organizationId,
          saleUtilityId: saleUtility.id,
          productId: item.productId,
          quantity: item.quantity,
          unitRevenue: item.unitRevenue,
          unitCost: item.unitCost,
          totalRevenue: item.totalRevenue,
          totalCost: item.totalCost,
          grossProfit: item.grossProfit,
          marginPercent: item.marginPercent,
          costSource: item.costSource,
        })),
      });
    }

    return SaleUtilityEntity.fromPrisma(saleUtility);
  }

  /** Hard-delete utility records when a sale is cancelled. */
  async deleteForSale(saleId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.saleUtility.deleteMany({ where: { saleId } });
  }

  // ─── Read ───────────────────────────────────────────────────────────────────

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where: Prisma.SaleUtilityWhereInput;
    includeItems?: boolean;
  }): Promise<[SaleUtilityEntity[], number]> {
    const { skip, take, where, includeItems } = params;
    const [rows, count] = await Promise.all([
      this.prisma.saleUtility.findMany({
        skip,
        take,
        where,
        orderBy: { createdAt: 'desc' },
        include: includeItems ? { items: true } : undefined,
      }),
      this.prisma.saleUtility.count({ where }),
    ]);
    return [rows.map(SaleUtilityEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<SaleUtilityEntity | null> {
    const raw = await this.prisma.saleUtility.findUnique({
      where: { id },
      include: { items: true },
    });
    return raw ? SaleUtilityEntity.fromPrisma(raw) : null;
  }

  /**
   * Aggregated summary: one object with totals for the given filters.
   * Uses Prisma aggregate — single SQL query.
   */
  async getSummary(
    where: Prisma.SaleUtilityWhereInput,
    dateFrom: string | undefined,
    dateTo: string | undefined,
  ): Promise<UtilitySummary> {
    const [agg, count] = await Promise.all([
      this.prisma.saleUtility.aggregate({
        where,
        _sum: {
          totalRevenue: true,
          totalCost: true,
          grossProfit: true,
        },
        _count: { id: true },
      }),
      this.prisma.saleUtility.count({ where }),
    ]);

    const totalRevenue = agg._sum.totalRevenue ?? new Prisma.Decimal(0);
    const totalCost = agg._sum.totalCost ?? new Prisma.Decimal(0);
    const grossProfit = agg._sum.grossProfit ?? new Prisma.Decimal(0);
    const marginPercent = totalRevenue.isZero()
      ? new Prisma.Decimal(0)
      : grossProfit.div(totalRevenue).times(100);

    return {
      totalRevenue,
      totalCost,
      grossProfit,
      marginPercent,
      salesCount: count,
      period: { from: dateFrom ?? null, to: dateTo ?? null },
    };
  }

  /**
   * Aggregated by product — uses raw groupBy on SaleItemUtility.
   * Single SQL query; no N+1.
   */
  async getByProduct(
    where: Prisma.SaleItemUtilityWhereInput,
  ): Promise<ProductUtilityRow[]> {
    // Prisma groupBy on SaleItemUtility + product join
    const grouped = await this.prisma.saleItemUtility.groupBy({
      by: ['productId'],
      where,
      _sum: {
        quantity: true,
        totalRevenue: true,
        totalCost: true,
        grossProfit: true,
      },
    });

    if (grouped.length === 0) return [];

    // Batch-load product names and categories
    const productIds = grouped.map((g) => g.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, categoryId: true, category: { select: { id: true, name: true } } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return grouped.map((g) => {
      const product = productMap.get(g.productId);
      const totalRevenue = g._sum.totalRevenue ?? new Prisma.Decimal(0);
      const grossProfit = g._sum.grossProfit ?? new Prisma.Decimal(0);
      const marginPercent = totalRevenue.isZero()
        ? new Prisma.Decimal(0)
        : grossProfit.div(totalRevenue).times(100);

      return {
        productId: g.productId,
        productName: product?.name ?? 'Unknown',
        categoryId: product?.categoryId ?? null,
        categoryName: product?.category?.name ?? null,
        unitsSold: g._sum.quantity ?? new Prisma.Decimal(0),
        totalRevenue,
        totalCost: g._sum.totalCost ?? new Prisma.Decimal(0),
        grossProfit,
        marginPercent,
      };
    });
  }

  /**
   * Aggregated by category — groups by categoryId from Product.
   */
  async getByCategory(
    where: Prisma.SaleItemUtilityWhereInput,
    organizationId: string,
  ): Promise<CategoryUtilityRow[]> {
    // We need product's categoryId — use raw aggregation via groupBy product then re-group by category
    const byProduct = await this.getByProduct(where);

    // Re-group by category in memory (avoids a complex raw query)
    const categoryMap = new Map<
      string | null,
      { categoryName: string | null; rows: ProductUtilityRow[] }
    >();

    for (const row of byProduct) {
      const key = row.categoryId ?? '__none__';
      if (!categoryMap.has(key)) {
        categoryMap.set(key, { categoryName: row.categoryName, rows: [] });
      }
      categoryMap.get(key)!.rows.push(row);
    }

    return [...categoryMap.entries()].map(([key, { categoryName, rows }]) => {
      const totalRevenue = rows.reduce((s, r) => s.plus(r.totalRevenue), new Prisma.Decimal(0));
      const totalCost = rows.reduce((s, r) => s.plus(r.totalCost), new Prisma.Decimal(0));
      const grossProfit = rows.reduce((s, r) => s.plus(r.grossProfit), new Prisma.Decimal(0));
      const unitsSold = rows.reduce((s, r) => s.plus(r.unitsSold), new Prisma.Decimal(0));
      const marginPercent = totalRevenue.isZero()
        ? new Prisma.Decimal(0)
        : grossProfit.div(totalRevenue).times(100);

      return {
        categoryId: key === '__none__' ? null : key,
        categoryName,
        unitsSold,
        totalRevenue,
        totalCost,
        grossProfit,
        marginPercent,
      };
    });
  }
}
