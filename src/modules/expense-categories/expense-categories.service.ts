import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ExpenseCategoriesRepository } from './expense-categories.repository.js';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto.js';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto.js';
import { FindExpenseCategoriesDto } from './dto/find-expense-categories.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { ExpenseCategoryEntity } from './domain/expense-category.entity.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly expenseCategoriesRepository: ExpenseCategoriesRepository) {}

  async create(createDto: CreateExpenseCategoryDto): Promise<ExpenseCategoryEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    // Comprobar si ya existe una categoría con el mismo nombre en la organización
    const [existing] = await this.expenseCategoriesRepository.findManyWithCount({
      where: {
        organizationId,
        name: { equals: createDto.name, mode: 'insensitive' },
      },
      take: 1,
    });

    if (existing.length > 0) {
      throw new BadRequestException(`Category with name "${createDto.name}" already exists`);
    }

    return this.expenseCategoriesRepository.create({
      ...createDto,
      organizationId,
    });
  }

  async findAll(query: FindExpenseCategoriesDto): Promise<PageDto<ExpenseCategoryEntity>> {
    const where: Prisma.ExpenseCategoryWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, count] = await this.expenseCategoriesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<ExpenseCategoryEntity> {
    const record = await this.expenseCategoriesRepository.findById(id);
    const tenantId = getTenantId();
    if (!record || (tenantId && record.organizationId !== tenantId)) {
      throw new NotFoundException(`ExpenseCategory with ID ${id} not found`);
    }
    return record;
  }

  async update(id: string, updateDto: UpdateExpenseCategoryDto): Promise<ExpenseCategoryEntity> {
    const current = await this.findOne(id);

    if (updateDto.name && updateDto.name.toLowerCase() !== current.name.toLowerCase()) {
      // Validar duplicado
      const [existing] = await this.expenseCategoriesRepository.findManyWithCount({
        where: {
          organizationId: current.organizationId,
          name: { equals: updateDto.name, mode: 'insensitive' },
          id: { not: id },
        },
        take: 1,
      });

      if (existing.length > 0) {
        throw new BadRequestException(`Category with name "${updateDto.name}" already exists`);
      }
    }

    return this.expenseCategoriesRepository.update(id, updateDto);
  }

  async remove(id: string): Promise<ExpenseCategoryEntity> {
    await this.findOne(id);
    return this.expenseCategoriesRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<ExpenseCategoryEntity> {
    await this.findOne(id);
    return this.expenseCategoriesRepository.update(id, { isActive });
  }
}
