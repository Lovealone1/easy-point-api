import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { TransactionCategoriesRepository } from './transaction-categories.repository.js';
import { CreateTransactionCategoryDto } from './dto/create-transaction-category.dto.js';
import { UpdateTransactionCategoryDto } from './dto/update-transaction-category.dto.js';
import { FindTransactionCategoriesDto } from './dto/find-transaction-categories.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { TransactionCategoryEntity } from './domain/transaction-category.entity.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionCategoriesService {
  constructor(private readonly transactionCategoriesRepository: TransactionCategoriesRepository) {}

  async create(createTransactionCategoryDto: CreateTransactionCategoryDto): Promise<TransactionCategoryEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    try {
      return await this.transactionCategoriesRepository.create({
        ...createTransactionCategoryDto,
        organizationId,
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'A transaction category with this name and type already exists for this organization',
        );
      }
      throw error;
    }
  }

  async findAll(query: FindTransactionCategoriesDto): Promise<PageDto<TransactionCategoryEntity>> {
    const where: Prisma.TransactionCategoryWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.organizationId) where.organizationId = query.organizationId;

    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.type) where.type = query.type;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, count] = await this.transactionCategoriesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<TransactionCategoryEntity> {
    const record = await this.transactionCategoriesRepository.findById(id);
    if (!record) throw new NotFoundException(`Transaction category with ID ${id} not found`);
    return record;
  }

  async update(id: string, updateTransactionCategoryDto: UpdateTransactionCategoryDto): Promise<TransactionCategoryEntity> {
    await this.findOne(id);
    
    try {
      return await this.transactionCategoriesRepository.update(id, updateTransactionCategoryDto);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'A transaction category with this name and type already exists for this organization',
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<TransactionCategoryEntity> {
    await this.findOne(id);
    return this.transactionCategoriesRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<TransactionCategoryEntity> {
    await this.findOne(id);
    return this.transactionCategoriesRepository.update(id, { isActive });
  }
}
