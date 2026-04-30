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

    // ── Validación de negocio ──────────────────────────────────────────────
    if (dto.type === ProductionType.SELLABLE && !dto.productId) {
      throw new BadRequestException('productId is required for SELLABLE productions');
    }

    // Cargar datos de los supplies a consumir
    const supplyIds = dto.supplies.map((s) => s.supplyId);
    const supplies = await this.prisma.supply.findMany({
      where: { id: { in: supplyIds }, organizationId },
    });

    if (supplies.length !== supplyIds.length) {
      throw new NotFoundException('One or more supplies not found in this organization');
    }

    const supplyMap = new Map(supplies.map((s) => [s.id, s]));

    // Cargar los stocks de cada supply
    const supplyStocks = await this.prisma.supplyStock.findMany({
      where: { supplyId: { in: supplyIds }, organizationId },
    });
    const stockMap = new Map(supplyStocks.map((s) => [s.supplyId, s]));

    // Verificar disponibilidad pre-transacción (lectura optimista rápida)
    for (const usage of dto.supplies) {
      const supply = supplyMap.get(usage.supplyId)!;
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
      // Para UNIT: verificamos que haya al menos 1 unidad
      if (!isMeasurable && new Prisma.Decimal(stock.quantity).lessThan(1)) {
        throw new UnprocessableEntityException(
          `No units available for supply "${supply.name}"`,
        );
      }
    }

    // ── Transacción atómica ────────────────────────────────────────────────
    return this.prisma.$transaction(async (tx) => {
      let totalCost = new Prisma.Decimal(0);
      const usageRecords: Array<{
        supplyId: string;
        supplyStockEntryId: string | null;
        quantityUsed: Prisma.Decimal;
        unitCost: Prisma.Decimal;
        totalCost: Prisma.Decimal;
      }> = [];

      // ── Crear producción en DRAFT ────────────────────────────────────────
      const production = await this.productionsRepository.create(
        {
          organizationId,
          name: dto.name,
          productionDate: new Date(dto.productionDate),
          type: dto.type,
          status: ProductionStatus.DRAFT,
          productId: dto.productId ?? null,
          quantityProduced: new Prisma.Decimal(dto.quantityProduced),
          unitOfMeasure: dto.unitOfMeasure,
          totalCost: new Prisma.Decimal(0),
          notes: dto.notes ?? null,
          performedByUserId: userId,
        },
        tx,
      );

      // ── Consumir insumos FIFO ────────────────────────────────────────────
      for (const usage of dto.supplies) {
        const supply = supplyMap.get(usage.supplyId)!;
        const stock = stockMap.get(usage.supplyId)!;
        const isMeasurable = MEASURABLE_UNITS.has(supply.unitOfMeasure);
        
        // Convertir la cantidad ingresada (ej. 300 gramos) a fracción de paquete (ej. 300 / 1000 = 0.3 paquetes)
        const quantityToConsumeInPackages = isMeasurable
          ? new Prisma.Decimal(usage.quantityUsed).dividedBy(supply.packageSize)
          : new Prisma.Decimal(usage.quantityUsed);

        let remaining = quantityToConsumeInPackages;
        let usageCostTotal = new Prisma.Decimal(0);
        let lastEntryId: string | null = null;

        if (isMeasurable) {
          // Consumo parcial FIFO a través de lotes
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
            lastEntryId = entry.id;

            // Crear registro de uso por lote consumido
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
          // UNIT: agota lotes completos hasta cubrir la cantidad
          const entries = await this.entriesRepository.findAvailableByStockId(stock.id, tx);
          let unitsToConsume = Math.ceil(new Prisma.Decimal(usage.quantityUsed).toNumber());

          for (const entry of entries) {
            if (unitsToConsume <= 0) break;
            const consumed = entry.consume(entry.remainingQuantity, true);
            await this.entriesRepository.updateConsumption(entry.id, entry.remainingQuantity, true, tx);

            const entryCost = entry.unitCost.times(consumed);
            usageCostTotal = usageCostTotal.plus(entryCost);
            lastEntryId = entry.id;

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

        // Actualizar SupplyStock.quantity usando la sincronización entera (Math.ceil)
        await this.supplyStocksRepository.syncQuantityWithEntries(stock.id, tx);

        // Calcular costo unitario promedio ponderado basado en el consumo FIFO
        const averageUnitCost = usageCostTotal.dividedBy(quantityToConsumeInPackages);

        // SupplyMovement PRODUCTION
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
            reason: `Producción: ${dto.name}`,
          },
        });
      }

      // ── Insertar ProductionSupplyUsage records ───────────────────────────
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

      // ── Si SELLABLE: incrementar ProductStock + InventoryMovement ────────
      if (dto.type === ProductionType.SELLABLE && dto.productId) {
        // Upsert ProductStock (Principal)
        const productStock = await tx.productStock.upsert({
          where: {
            productId_location: { productId: dto.productId, location: 'Principal' },
          },
          update: {
            quantity: { increment: new Prisma.Decimal(dto.quantityProduced) },
          },
          create: {
            organizationId,
            productId: dto.productId,
            location: 'Principal',
            quantity: new Prisma.Decimal(dto.quantityProduced),
            minQuantity: new Prisma.Decimal(0),
          },
        });

        await tx.inventoryMovement.create({
          data: {
            organizationId,
            productId: dto.productId,
            stockId: productStock.id,
            quantity: new Prisma.Decimal(dto.quantityProduced),
            unitCost: totalCost.dividedBy(dto.quantityProduced),
            type: MovementType.PRODUCTION,
            productionId: production.id,
            performedByUserId: userId,
            reason: `Producción completada: ${dto.name}`,
          },
        });
      }

      // ── Actualizar producción a COMPLETED con totalCost ──────────────────
      return this.productionsRepository.update(
        production.id,
        { status: ProductionStatus.COMPLETED, totalCost },
        tx,
      );
    });
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
      throw new BadRequestException('Cannot delete a completed production');
    }
    return this.productionsRepository.delete(id);
  }
}
