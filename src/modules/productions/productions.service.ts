import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProductionsRepository } from './productions.repository.js';
import { SupplyStockEntriesRepository } from '../supply-stock-entries/supply-stock-entries.repository.js';
import { SupplyStocksRepository } from '../supply-stocks/supply-stocks.repository.js';
import { CreateProductionDto } from './dto/create-production.dto.js';
import { FindProductionsDto } from './dto/find-productions.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { ProductionEntity } from './domain/production.entity.js';
import {
  Prisma,
  ProductionType,
  ProductionStatus,
  SupplyMovementType,
  MovementType,
  UnitOfMeasure,
} from '@prisma/client';

/** Unidades que permiten consumo parcial de un lote */
const MEASURABLE_UNITS = new Set<UnitOfMeasure>([
  UnitOfMeasure.GRAM,
  UnitOfMeasure.MILLILITER,
]);

@Injectable()
export class ProductionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productionsRepository: ProductionsRepository,
    private readonly entriesRepository: SupplyStockEntriesRepository,
    private readonly supplyStocksRepository: SupplyStocksRepository,
  ) {}

  // ─── CRUD básico ──────────────────────────────────────────────────────────

  async findAll(query: FindProductionsDto): Promise<PageDto<ProductionEntity>> {
    const where: Prisma.ProductionWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.productId) where.productId = query.productId;

    const [items, count] = await this.productionsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<ProductionEntity> {
    const production = await this.productionsRepository.findById(id);
    if (!production) throw new NotFoundException(`Production ${id} not found`);
    return production;
  }

  // ─── Creación + ejecución atómica ─────────────────────────────────────────

  /**
   * Crea y completa una producción en un único bloque atómico:
   *
   * 1. Valida reglas de negocio (SELLABLE requiere productId, insumos suficientes).
   * 2. Consume insumos en orden FIFO descontando SupplyStockEntry.remainingQuantity.
   * 3. Actualiza SupplyStock.quantity (agregado).
   * 4. Crea un SupplyMovement PRODUCTION por cada insumo consumido.
   * 5. Crea registros ProductionSupplyUsage con el detalle de costo.
   * 6. Si SELLABLE: incrementa ProductStock y crea InventoryMovement PRODUCTION.
   * 7. Persiste Production con status=COMPLETED y totalCost calculado.
   */
  
  async create(dto: CreateProductionDto, userId: string): Promise<ProductionEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    if (dto.type === ProductionType.SELLABLE && !dto.productId) {
      throw new BadRequestException('productId is required for SELLABLE productions');
    }

    const supplyIds = dto.supplies.map((s) => s.supplyId);
    const supplies = await this.prisma.supply.findMany({
      where: { id: { in: supplyIds }, organizationId },
    });

    if (supplies.length !== supplyIds.length) {
      throw new NotFoundException('One or more supplies not found in this organization');
    }

    const isDraft = dto.status === ProductionStatus.DRAFT;

    return this.prisma.$transaction(async (tx) => {
      const production = await this.productionsRepository.create(
        {
          organizationId,
          name: dto.name,
          productionDate: new Date(dto.productionDate),
          type: dto.type,
          status: isDraft ? ProductionStatus.DRAFT : ProductionStatus.COMPLETED,
          productId: dto.productId ?? null,
          quantityProduced: new Prisma.Decimal(dto.quantityProduced),
          unitOfMeasure: dto.unitOfMeasure,
          totalCost: new Prisma.Decimal(0),
          notes: dto.notes ?? null,
          performedByUserId: userId,
        },
        tx,
      );

      if (isDraft) {
        // Just save intended usages
        await tx.productionSupplyUsage.createMany({
          data: dto.supplies.map((s) => ({
            productionId: production.id,
            supplyId: s.supplyId,
            supplyStockEntryId: null,
            quantityUsed: new Prisma.Decimal(s.quantityUsed),
            unitCost: new Prisma.Decimal(0),
            totalCost: new Prisma.Decimal(0),
          })),
        });
        return production;
      }

      // If not draft, process completion immediately
      return this.processProductionCompletion(
        tx,
        organizationId,
        userId,
        production,
        dto.supplies,
        supplies,
      );
    });
  }

  async complete(id: string, userId: string): Promise<ProductionEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    const production = await this.findOne(id);
    if (!production.canComplete()) {
      throw new BadRequestException(
        `Production ${id} cannot be completed (status: ${production.status})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Get intended supplies
      const usages = await tx.productionSupplyUsage.findMany({
        where: { productionId: id },
      });

      if (usages.length === 0) {
        throw new UnprocessableEntityException('Production has no supplies defined');
      }

      const suppliesInput = usages.map((u) => ({
        supplyId: u.supplyId,
        quantityUsed: u.quantityUsed.toNumber(),
      }));

      const supplyIds = suppliesInput.map((s) => s.supplyId);
      const supplies = await tx.supply.findMany({
        where: { id: { in: supplyIds }, organizationId },
      });

      // Clear draft usages
      await tx.productionSupplyUsage.deleteMany({
        where: { productionId: id },
      });

      return this.processProductionCompletion(
        tx,
        organizationId,
        userId,
        production,
        suppliesInput,
        supplies,
      );
    });
  }

  private async processProductionCompletion(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
    production: ProductionEntity,
    suppliesInput: { supplyId: string; quantityUsed: number }[],
    suppliesData: any[],
  ): Promise<ProductionEntity> {
    const supplyMap = new Map(suppliesData.map((s) => [s.id, s]));

    const supplyIds = suppliesInput.map((s) => s.supplyId);
    const supplyStocks = await tx.supplyStock.findMany({
      where: { supplyId: { in: supplyIds }, organizationId },
    });
    const stockMap = new Map(supplyStocks.map((s) => [s.supplyId, s]));

    // Validation
    for (const usage of suppliesInput) {
      const supply = supplyMap.get(usage.supplyId);
      const stock = stockMap.get(usage.supplyId);
      if (!stock) {
        throw new UnprocessableEntityException(
          `Supply ${supply.name} has no associated stock`,
        );
      }

      const isMeasurable = MEASURABLE_UNITS.has(supply.unitOfMeasure);
      const requiredInPackages = isMeasurable
        ? new Prisma.Decimal(usage.quantityUsed).dividedBy(supply.packageSize)
        : new Prisma.Decimal(usage.quantityUsed);

      if (isMeasurable && new Prisma.Decimal(stock.quantity).lessThan(requiredInPackages)) {
        throw new UnprocessableEntityException(
          `Insufficient stock for supply "${supply.name}": required ${requiredInPackages.toFixed(2)} packages (you asked for ${usage.quantityUsed}), available ${stock.quantity} packages`,
        );
      }
      if (!isMeasurable && new Prisma.Decimal(stock.quantity).lessThan(1)) {
        throw new UnprocessableEntityException(
          `No units available for supply "${supply.name}"`,
        );
      }
    }

    let totalCost = new Prisma.Decimal(0);
    const usageRecords: Array<{
      supplyId: string;
      supplyStockEntryId: string | null;
      quantityUsed: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      totalCost: Prisma.Decimal;
    }> = [];

    // Consume FIFO
    for (const usage of suppliesInput) {
      const supply = supplyMap.get(usage.supplyId)!;
      const stock = stockMap.get(usage.supplyId)!;
      const isMeasurable = MEASURABLE_UNITS.has(supply.unitOfMeasure);
      
      const quantityToConsumeInPackages = isMeasurable
        ? new Prisma.Decimal(usage.quantityUsed).dividedBy(supply.packageSize)
        : new Prisma.Decimal(usage.quantityUsed);

      let remaining = quantityToConsumeInPackages;
      let usageCostTotal = new Prisma.Decimal(0);

      if (isMeasurable) {
        const entries = await this.entriesRepository.findAvailableByStockId(stock.id, tx);
        if (entries.length === 0) {
          throw new UnprocessableEntityException(
            `No available stock entries for supply "${supply.name}"`,
          );
        }

        for (const entry of entries) {
          if (remaining.isZero()) break;
          const toConsume = Prisma.Decimal.min(remaining, entry.remainingQuantity);
          const entryCost = entry.unitCost.times(toConsume);

          entry.consume(toConsume);
          await this.entriesRepository.updateConsumption(
            entry.id,
            entry.remainingQuantity,
            entry.isExhausted,
            tx,
          );

          usageCostTotal = usageCostTotal.plus(entryCost);
          remaining = remaining.minus(toConsume);

          usageRecords.push({
            supplyId: usage.supplyId,
            supplyStockEntryId: entry.id,
            quantityUsed: toConsume,
            unitCost: entry.unitCost,
            totalCost: entryCost,
          });
        }

        if (!remaining.isZero()) {
          throw new UnprocessableEntityException(
            `Insufficient measurable stock for supply "${supply.name}"`,
          );
        }
      } else {
        const entries = await this.entriesRepository.findAvailableByStockId(stock.id, tx);
        let unitsToConsume = Math.ceil(new Prisma.Decimal(usage.quantityUsed).toNumber());

        for (const entry of entries) {
          if (unitsToConsume <= 0) break;
          const consumed = entry.consume(entry.remainingQuantity, true);
          await this.entriesRepository.updateConsumption(entry.id, entry.remainingQuantity, true, tx);

          const entryCost = entry.unitCost.times(consumed);
          usageCostTotal = usageCostTotal.plus(entryCost);

          usageRecords.push({
            supplyId: usage.supplyId,
            supplyStockEntryId: entry.id,
            quantityUsed: consumed,
            unitCost: entry.unitCost,
            totalCost: entryCost,
          });
          unitsToConsume -= 1;
        }
      }

      totalCost = totalCost.plus(usageCostTotal);

      await this.supplyStocksRepository.syncQuantityWithEntries(stock.id, tx);

      const averageUnitCost = usageCostTotal.dividedBy(quantityToConsumeInPackages);

      await tx.supplyMovement.create({
        data: {
          organizationId,
          supplyId: usage.supplyId,
          stockId: stock.id,
          quantity: quantityToConsumeInPackages.negated(),
          unitCost: averageUnitCost,
          type: SupplyMovementType.PRODUCTION,
          productionId: production.id,
          performedByUserId: userId,
          reason: `Producción: ${production.name}`,
        },
      });
    }

    await tx.productionSupplyUsage.createMany({
      data: usageRecords.map((r) => ({
        productionId: production.id,
        supplyId: r.supplyId,
        supplyStockEntryId: r.supplyStockEntryId,
        quantityUsed: r.quantityUsed,
        unitCost: r.unitCost,
        totalCost: r.totalCost,
      })),
    });

    if (production.isSellable() && production.productId) {
      const productStock = await tx.productStock.upsert({
        where: {
          productId_location: { productId: production.productId, location: 'Principal' },
        },
        update: {
          quantity: { increment: new Prisma.Decimal(production.quantityProduced) },
        },
        create: {
          organizationId,
          productId: production.productId,
          location: 'Principal',
          quantity: new Prisma.Decimal(production.quantityProduced),
          minQuantity: new Prisma.Decimal(0),
        },
      });

      await tx.inventoryMovement.create({
        data: {
          organizationId,
          productId: production.productId,
          stockId: productStock.id,
          quantity: new Prisma.Decimal(production.quantityProduced),
          unitCost: totalCost.dividedBy(production.quantityProduced),
          type: MovementType.PRODUCTION,
          productionId: production.id,
          performedByUserId: userId,
          reason: `Producción completada: ${production.name}`,
        },
      });
    }

    return this.productionsRepository.update(
      production.id,
      { status: ProductionStatus.COMPLETED, totalCost },
      tx,
    );
  }

  // ─── Cancelación ──────────────────────────────────────────────────────────

  async cancel(id: string): Promise<ProductionEntity> {
    const production = await this.findOne(id);
    if (!production.canCancel()) {
      throw new BadRequestException(
        `Production ${id} cannot be cancelled (status: ${production.status})`,
      );
    }
    return this.productionsRepository.update(id, { status: ProductionStatus.CANCELLED });
  }

  async remove(id: string): Promise<ProductionEntity> {
    const production = await this.findOne(id);
    
    if (production.isCompleted()) {
      await this.prisma.$transaction(async (tx) => {
        // 1. Revert Inventory Movement & Product Stock (If Sellable)
        if (production.isSellable() && production.productId) {
          const prodId = production.productId;
          await tx.inventoryMovement.deleteMany({
            where: { productionId: id },
          });

          await tx.productStock.updateMany({
            where: {
              organizationId: production.organizationId,
              productId: prodId,
              location: 'Principal',
            },
            data: {
              quantity: { decrement: new Prisma.Decimal(production.quantityProduced) },
            },
          });
        }

        // 2. Revert Supply Movements
        await tx.supplyMovement.deleteMany({
          where: { productionId: id },
        });

        // 3. Revert Supply Stock Entries
        const usages = await tx.productionSupplyUsage.findMany({
          where: { productionId: id },
        });

        const affectedStockIds = new Set<string>();

        for (const usage of usages) {
          if (!usage.supplyStockEntryId) continue;

          const entry = await tx.supplyStockEntry.findUnique({
            where: { id: usage.supplyStockEntryId },
          });
          if (entry) {
            affectedStockIds.add(entry.supplyStockId);
            await tx.supplyStockEntry.update({
              where: { id: entry.id },
              data: {
                remainingQuantity: { increment: usage.quantityUsed },
                isExhausted: false,
              },
            });
          }
        }

        // 4. Delete Usages
        await tx.productionSupplyUsage.deleteMany({
          where: { productionId: id },
        });

        // 5. Sync Supply Stocks (Math.ceil over restored fractions)
        for (const stockId of affectedStockIds) {
          await this.supplyStocksRepository.syncQuantityWithEntries(stockId, tx);
        }

        // 6. Finally, delete the Production
        await tx.production.delete({ where: { id } });
      });

      return production;
    }

    // For DRAFT or CANCELLED
    return this.productionsRepository.delete(id);
  }
}
