import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductStocksRepository } from './product-stocks.repository.js';
import { CreateProductStockDto } from './dto/create-product-stock.dto.js';
import { UpdateProductStockDto } from './dto/update-product-stock.dto.js';
import { FindProductStocksDto } from './dto/find-product-stocks.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { ProductStockEntity } from './domain/product-stock.entity.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductStocksService {
  constructor(private readonly productStocksRepository: ProductStocksRepository) {}

  async create(createProductStockDto: CreateProductStockDto): Promise<ProductStockEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    return this.productStocksRepository.create({
      ...createProductStockDto,
      organizationId,
      quantity: new Prisma.Decimal(0),
      minQuantity: createProductStockDto.minQuantity !== undefined 
        ? new Prisma.Decimal(createProductStockDto.minQuantity) 
        : undefined,
    });
  }

  async findAll(query: FindProductStocksDto): Promise<PageDto<ProductStockEntity>> {
    const where: Prisma.ProductStockWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.productId) where.productId = query.productId;
    if (query.location) where.location = { contains: query.location, mode: 'insensitive' };

    const [items, count] = await this.productStocksRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<ProductStockEntity> {
    const record = await this.productStocksRepository.findById(id);
    if (!record) throw new NotFoundException(`ProductStock with ID ${id} not found`);
    return record;
  }

  async update(id: string, updateProductStockDto: UpdateProductStockDto): Promise<ProductStockEntity> {
    await this.findOne(id);
    return this.productStocksRepository.update(id, {
      ...updateProductStockDto,
      minQuantity: updateProductStockDto.minQuantity !== undefined 
        ? new Prisma.Decimal(updateProductStockDto.minQuantity) 
        : undefined,
    });
  }

  async remove(id: string): Promise<ProductStockEntity> {
    await this.findOne(id);
    return this.productStocksRepository.delete(id);
  }
}
