import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupplyStocksRepository } from './supply-stocks.repository.js';
import { CreateSupplyStockDto } from './dto/create-supply-stock.dto.js';
import { FindSupplyStocksDto } from './dto/find-supply-stocks.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { SupplyStockEntity } from './domain/supply-stock.entity.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class SupplyStocksService {
  constructor(private readonly supplyStocksRepository: SupplyStocksRepository) {}

  async create(createSupplyStockDto: CreateSupplyStockDto): Promise<SupplyStockEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    return this.supplyStocksRepository.create({
      ...createSupplyStockDto,
      organizationId,
      quantity: new Prisma.Decimal(0),
      minQuantity: createSupplyStockDto.minQuantity !== undefined 
        ? new Prisma.Decimal(createSupplyStockDto.minQuantity) 
        : undefined,
    });
  }

  async findAll(query: FindSupplyStocksDto): Promise<PageDto<SupplyStockEntity>> {
    const where: Prisma.SupplyStockWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.supplyId) where.supplyId = query.supplyId;
    if (query.location) where.location = { contains: query.location, mode: 'insensitive' };

    const [items, count] = await this.supplyStocksRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<SupplyStockEntity> {
    const record = await this.supplyStocksRepository.findById(id);
    if (!record) throw new NotFoundException(`SupplyStock with ID ${id} not found`);
    return record;
  }
}
