import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SuppliesRepository } from './supplies.repository.js';
import { CreateSupplyDto } from './dto/create-supply.dto.js';
import { UpdateSupplyDto } from './dto/update-supply.dto.js';
import { FindSuppliesDto } from './dto/find-supplies.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class SuppliesService {
  constructor(private readonly suppliesRepository: SuppliesRepository) {}

  async create(createSupplyDto: CreateSupplyDto) {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    return this.suppliesRepository.create({
      ...createSupplyDto,
      organizationId,
      basePrice: new Prisma.Decimal(createSupplyDto.basePrice),
      packageSize: new Prisma.Decimal(createSupplyDto.packageSize),
      ...(createSupplyDto.quantityInStock !== undefined && {
        quantityInStock: new Prisma.Decimal(createSupplyDto.quantityInStock),
      }),
    });
  }

  async findAll(query: FindSuppliesDto) {
    const where: Prisma.SupplyWhereInput = {};

    // Para listados de org, el tenant context impone el filtro de organización
    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    // El admin global puede pasar organizationId como query param para filtrar
    if (query.organizationId) where.organizationId = query.organizationId;

    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.unitOfMeasure) where.unitOfMeasure = query.unitOfMeasure;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, count] = await this.suppliesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string) {
    const supply = await this.suppliesRepository.findById(id);
    if (!supply) {
      throw new NotFoundException(`Supply with ID ${id} not found`);
    }
    return supply;
  }

  async update(id: string, updateSupplyDto: UpdateSupplyDto) {
    const currentSupply = await this.findOne(id);
    return this.suppliesRepository.update(id, updateSupplyDto, currentSupply);
  }

  async updateStock(id: string, quantityInStock: number) {
    await this.findOne(id);
    return this.suppliesRepository.updateStock(
      id,
      new Prisma.Decimal(quantityInStock),
    );
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.suppliesRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean) {
    const currentSupply = await this.findOne(id);
    return this.suppliesRepository.update(id, { isActive }, currentSupply);
  }

  async addNote(id: string, notes: string) {
    const supply = await this.findOne(id);
    const newNotes = supply.notes ? `${supply.notes}\n${notes}` : notes;
    return this.suppliesRepository.update(id, { notes: newNotes }, supply);
  }
}
