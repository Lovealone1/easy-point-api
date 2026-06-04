import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UtilitiesRepository } from './utilities.repository.js';
import { FindUtilitiesDto } from './dto/find-utilities.dto.js';
import { SaleUtilityEntity } from './domain/sale-utility.entity.js';
import { SaleItemUtilityEntity } from './domain/sale-item-utility.entity.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { Prisma, CostSource } from '@prisma/client';

@Injectable()
export class UtilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utilitiesRepository: UtilitiesRepository,
  ) {}

  // ─── Write (called by SalesService within its transaction) ────────────────

  /**
   * Computes and persists utility records for a completed sale.
   * MUST be called inside the same prisma.$transaction that creates the Sale.
   *
   * Cost hierarchy per product:
   *  1. PRODUCTION → latest completed Production.totalCost / quantityProduced
   *  2. ESTIMATED  → Product.costPrice
   *  3. UNKNOWN    → unitCost = 0
   */
  async computeAndPersist(
    saleId: string,
    organizationId: string,
    movements: Array<{
      productId: string;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal | null; // unitCost on InventoryMovement = sale unit price (unitRevenue)
    }>,
    tx: Prisma.TransactionClient,
  ): Promise<SaleUtilityEntity> {
    const productIds = [...new Set(movements.map((m) => m.productId))];

    // Load costPrice for each product in one query — no N+1
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, costPrice: true },
    });

    // Map productId → costPrice (Decimal | null)
    const costPriceMap = new Map(products.map((p) => [p.id, p.costPrice]));

    // Compute utility per movement line
    const computedItems: Array<ReturnType<typeof SaleItemUtilityEntity.compute>> = [];

    for (const mov of movements) {
      // unitRevenue = what the customer paid per unit (stored as unitCost on InventoryMovement for SALE type)
      const unitRevenue = mov.unitCost ?? new Prisma.Decimal(0);

      // unitCost = product's configured cost price for margin calculation
      const cp = costPriceMap.get(mov.productId);
      let unitCost: Prisma.Decimal;
      let costSource: CostSource;

      if (cp != null) {
        unitCost = new Prisma.Decimal(cp);
        costSource = CostSource.ESTIMATED;
      } else {
        unitCost = new Prisma.Decimal(0);
        costSource = CostSource.UNKNOWN;
      }

      const computed = SaleItemUtilityEntity.compute({
        organizationId,
        saleUtilityId: '',
        productId: mov.productId,
        quantity: mov.quantity,
        unitRevenue,
        unitCost,
        costSource,
      });

      computedItems.push(computed);
    }

    // Aggregate to sale-level totals using entity logic
    const aggregated = SaleUtilityEntity.aggregateFromItems(organizationId, saleId, computedItems);

    return this.utilitiesRepository.createForSale(
      {
        organizationId,
        saleId,
        ...aggregated,
        items: computedItems.map((item) => ({
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
      },
      tx,
    );
  }


  /** Removes utility records when a completed sale is cancelled. */
  async deleteForSale(saleId: string, tx: Prisma.TransactionClient): Promise<void> {
    await this.utilitiesRepository.deleteForSale(saleId, tx);
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  async findAll(query: FindUtilitiesDto): Promise<PageDto<SaleUtilityEntity>> {
    const where = this.buildSaleUtilityWhere(query);

    const [items, count] = await this.utilitiesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      includeItems: true,
    });

    const meta = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, meta);
  }

  async findOne(id: string): Promise<SaleUtilityEntity> {
    const organizationId = getTenantId();
    const record = await this.utilitiesRepository.findById(id);
    if (!record) throw new NotFoundException(`SaleUtility with ID ${id} not found`);
    if (organizationId && record.organizationId !== organizationId) {
      throw new NotFoundException(`SaleUtility with ID ${id} not found`);
    }
    return record;
  }

  async getSummary(query: FindUtilitiesDto) {
    const where = this.buildSaleUtilityWhere(query);
    return this.utilitiesRepository.getSummary(
      where,
      query.dateFrom,
      query.dateTo,
    );
  }

  async getByProduct(query: FindUtilitiesDto) {
    const where = this.buildItemWhere(query);
    return this.utilitiesRepository.getByProduct(where);
  }

  async getByCategory(query: FindUtilitiesDto) {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    const where = this.buildItemWhere(query);
    return this.utilitiesRepository.getByCategory(where, organizationId);
  }

  // ─── Where builders ───────────────────────────────────────────────────────

  /** Builds the SaleUtility WHERE clause from query filters. */
  private buildSaleUtilityWhere(query: FindUtilitiesDto): Prisma.SaleUtilityWhereInput {
    const organizationId = getTenantId();
    const where: Prisma.SaleUtilityWhereInput = {};

    if (organizationId) where.organizationId = organizationId;
    if (query.organizationId) where.organizationId = query.organizationId;

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    // Filters that require a join to Sale
    const saleFilter: Prisma.SaleWhereInput = {};
    if (query.clientId) saleFilter.clientId = query.clientId;
    if (query.performedByUserId) saleFilter.performedByUserId = query.performedByUserId;
    if (query.paymentMethod) {
      saleFilter.transaction = { paymentMethod: query.paymentMethod };
    }
    if (Object.keys(saleFilter).length > 0) {
      where.sale = saleFilter;
    }

    // Item-level product/category filters
    if (query.productId || query.categoryId) {
      where.items = {
        some: {
          ...(query.productId ? { productId: query.productId } : {}),
          ...(query.categoryId
            ? { product: { categoryId: query.categoryId } }
            : {}),
        },
      };
    }

    if (query.search) {
      where.OR = [
        { saleId: { contains: query.search, mode: 'insensitive' } },
        { sale: { client: { name: { contains: query.search, mode: 'insensitive' } } } },
        { sale: { performedBy: { email: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    return where;
  }

  /** Builds the SaleItemUtility WHERE clause for aggregation endpoints. */
  private buildItemWhere(query: FindUtilitiesDto): Prisma.SaleItemUtilityWhereInput {
    const organizationId = getTenantId();
    const where: Prisma.SaleItemUtilityWhereInput = {};

    if (organizationId) where.organizationId = organizationId;
    if (query.organizationId) where.organizationId = query.organizationId;

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    if (query.productId) where.productId = query.productId;
    if (query.categoryId) {
      where.product = { categoryId: query.categoryId };
    }

    if (query.clientId || query.performedByUserId || query.paymentMethod) {
      const saleFilter: Prisma.SaleWhereInput = {};
      if (query.clientId) saleFilter.clientId = query.clientId;
      if (query.performedByUserId) saleFilter.performedByUserId = query.performedByUserId;
      if (query.paymentMethod) {
        saleFilter.transaction = { paymentMethod: query.paymentMethod };
      }
      where.saleUtility = { sale: saleFilter };
    }

    if (query.search) {
      where.OR = [
        { productId: { contains: query.search, mode: 'insensitive' } },
        { product: { name: { contains: query.search, mode: 'insensitive' } } },
        { saleUtility: { sale: { client: { name: { contains: query.search, mode: 'insensitive' } } } } },
        { saleUtility: { sale: { performedBy: { email: { contains: query.search, mode: 'insensitive' } } } } },
      ];
    }

    return where;
  }
}
