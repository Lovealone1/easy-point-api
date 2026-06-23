import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PlansRepository } from './plans.repository.js';
import { CreatePlanDto } from './dto/create-plan.dto.js';
import { UpdatePlanDto } from './dto/update-plan.dto.js';
import { FindPlansDto } from './dto/find-plans.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { PlanEntity } from './domain/plan.entity.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class PlansService {
  constructor(private readonly plansRepository: PlansRepository) {}

  async create(createPlanDto: CreatePlanDto): Promise<PlanEntity> {
    const existing = await this.plansRepository.findByName(createPlanDto.name);
    if (existing) {
      throw new BadRequestException(`Plan with name "${createPlanDto.name}" already exists`);
    }

    return this.plansRepository.create({
      name: createPlanDto.name,
      description: createPlanDto.description ?? null,
      monthlyPrice: new Prisma.Decimal(createPlanDto.monthlyPrice),
      yearlyPrice: new Prisma.Decimal(createPlanDto.yearlyPrice),
      currency: createPlanDto.currency ?? 'COP',
      isActive: createPlanDto.isActive ?? true,
      metadata: createPlanDto.metadata ?? null,
    });
  }

  async findAll(query: FindPlansDto): Promise<PageDto<PlanEntity>> {
    const where: Prisma.PlanWhereInput = {};

    if (query.name) {
      where.name = { contains: query.name, mode: 'insensitive' };
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, count] = await this.plansRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<PlanEntity> {
    const record = await this.plansRepository.findById(id);
    if (!record) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return record;
  }

  async update(id: string, updatePlanDto: UpdatePlanDto): Promise<PlanEntity> {
    await this.findOne(id);

    if (updatePlanDto.name) {
      const existing = await this.plansRepository.findByName(updatePlanDto.name);
      if (existing && existing.id !== id) {
        throw new BadRequestException(`Plan with name "${updatePlanDto.name}" already exists`);
      }
    }

    const updateData: Prisma.PlanUpdateInput = {};
    if (updatePlanDto.name !== undefined) updateData.name = updatePlanDto.name;
    if (updatePlanDto.description !== undefined) updateData.description = updatePlanDto.description;
    if (updatePlanDto.monthlyPrice !== undefined) updateData.monthlyPrice = new Prisma.Decimal(updatePlanDto.monthlyPrice);
    if (updatePlanDto.yearlyPrice !== undefined) updateData.yearlyPrice = new Prisma.Decimal(updatePlanDto.yearlyPrice);
    if (updatePlanDto.currency !== undefined) updateData.currency = updatePlanDto.currency;
    if (updatePlanDto.isActive !== undefined) updateData.isActive = updatePlanDto.isActive;
    if (updatePlanDto.metadata !== undefined) updateData.metadata = updatePlanDto.metadata;

    return this.plansRepository.update(id, updateData);
  }

  async remove(id: string): Promise<PlanEntity> {
    await this.findOne(id);
    return this.plansRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<PlanEntity> {
    await this.findOne(id);
    return this.plansRepository.update(id, { isActive });
  }
}
