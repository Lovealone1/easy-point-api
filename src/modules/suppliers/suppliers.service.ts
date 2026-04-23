import { Injectable, NotFoundException } from '@nestjs/common';
import { SuppliersRepository } from './suppliers.repository.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { FindSuppliersDto } from './dto/find-suppliers.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { Prisma } from '@prisma/client';
import { getTenantId } from '../../common/context/tenant.context.js';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class SuppliersService {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  async create(createSupplierDto: CreateSupplierDto) {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }
    return this.suppliersRepository.create({
      ...createSupplierDto,
      organizationId,
    });
  }

  async findAll(query: FindSuppliersDto) {
    const where: Prisma.SupplierWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) {
      where.organizationId = tenantId;
    } else if (query.organizationId) {
      // For global admin if tenant is not present
      where.organizationId = query.organizationId;
    }

    if (query.name) {
      where.name = { contains: query.name, mode: 'insensitive' };
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [items, count] = await this.suppliersRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string) {
    const supplier = await this.suppliersRepository.findById(id);
    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }
    return supplier;
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    const current = await this.findOne(id);
    return this.suppliersRepository.update(id, updateSupplierDto, current);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.suppliersRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean) {
    const current = await this.findOne(id);
    return this.suppliersRepository.update(id, { isActive }, current);
  }

  async addNote(id: string, notes: string) {
    const supplier = await this.findOne(id);
    supplier.appendNote(notes);
    return this.suppliersRepository.update(id, { notes: supplier.notes }, supplier);
  }
}
