import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupplyStockEntriesRepository } from './supply-stock-entries.repository.js';
import { SupplyStocksRepository } from '../supply-stocks/supply-stocks.repository.js';
import { CreateSupplyStockEntryDto } from './dto/create-supply-stock-entry.dto.js';
import { FindSupplyStockEntriesDto } from './dto/find-supply-stock-entries.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { SupplyStockEntryEntity } from './domain/supply-stock-entry.entity.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class SupplyStockEntriesService {
  constructor(
    private readonly entriesRepository: SupplyStockEntriesRepository,
    private readonly supplyStocksRepository: SupplyStocksRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Crea un nuevo lote físico para un SupplyStock existente.
   * Incrementa automáticamente SupplyStock.quantity.
   */
  async create(dto: CreateSupplyStockEntryDto): Promise<SupplyStockEntryEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    const stock = await this.supplyStocksRepository.findById(dto.supplyStockId);
    if (!stock) throw new NotFoundException(`SupplyStock ${dto.supplyStockId} not found`);
    if (stock.organizationId !== organizationId) {
      throw new BadRequestException('SupplyStock does not belong to this organization');
    }

    const qty = new Prisma.Decimal(dto.initialQuantity);
    const cost = new Prisma.Decimal(dto.unitCost);

    return this.prisma.$transaction(async (tx) => {
      const entry = await this.entriesRepository.create(
        {
          organizationId,
          supplyStockId: dto.supplyStockId,
          supplyPurchaseId: dto.supplyPurchaseId ?? null,
          initialQuantity: qty,
          remainingQuantity: qty,
          unitCost: cost,
          isExhausted: false,
        },
        tx,
      );

      // Incrementar el stock agregado
      await this.supplyStocksRepository.incrementQuantity(stock.id, qty, tx);

      return entry;
    });
  }

  async findAll(query: FindSupplyStockEntriesDto): Promise<PageDto<SupplyStockEntryEntity>> {
    const where: Prisma.SupplyStockEntryWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.supplyStockId) where.supplyStockId = query.supplyStockId;
    if (query.supplyPurchaseId) where.supplyPurchaseId = query.supplyPurchaseId;
    if (query.isExhausted !== undefined) where.isExhausted = query.isExhausted;

    const [items, count] = await this.entriesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<SupplyStockEntryEntity> {
    const entry = await this.entriesRepository.findById(id);
    if (!entry) throw new NotFoundException(`SupplyStockEntry ${id} not found`);
    return entry;
  }

  /**
   * Endpoint de reparación: inicializa un SupplyStockEntry vacío para
   * SupplyStocks que existan pero no tengan ningún entry registrado.
   * Útil para datos legacy o supplies creados antes de este módulo.
   */
  async initializeMissingEntries(): Promise<{ initialized: number; stockIds: string[] }> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    // Stocks de la org que no tienen ningún entry
    const stocksWithoutEntries = await this.prisma.supplyStock.findMany({
      where: {
        organizationId,
        entries: { none: {} },
      },
      include: { supply: { select: { pricePerUnit: true } } },
    });

    const initialized: string[] = [];

    for (const stock of stocksWithoutEntries) {
      await this.entriesRepository.initializeForStock(
        stock.id,
        organizationId,
        stock.supply.pricePerUnit,
      );
      initialized.push(stock.id);
    }

    return { initialized: initialized.length, stockIds: initialized };
  }
}
