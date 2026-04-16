import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { UpdateOrganizationPlanDto } from './dto/update-organization-plan.dto.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';

import { Prisma } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    return this.prisma.organization.create({
      data: createOrganizationDto,
    });
  }

  async findAll(pageOptionsDto: PageOptionsDto) {
    const skip = pageOptionsDto.skip;
    const take = pageOptionsDto.limit;
    
    const orderDirection = pageOptionsDto.order ? (pageOptionsDto.order.toLowerCase() as Prisma.SortOrder) : 'desc';
    const orderBy: Prisma.OrganizationOrderByWithRelationInput = pageOptionsDto.orderBy 
      ? ({ [pageOptionsDto.orderBy]: orderDirection } as Prisma.OrganizationOrderByWithRelationInput) 
      : { createdAt: 'desc' };

    const where = pageOptionsDto.search
      ? { name: { contains: pageOptionsDto.search, mode: 'insensitive' as any } }
      : {};

    const [data, itemCount] = await Promise.all([
      this.prisma.organization.findMany({
        skip,
        take,
        orderBy,
        where,
      }),
      this.prisma.organization.count({ where }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
    return new PageDto(data, pageMetaDto);
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });
    
    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    
    return organization;
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    await this.findOne(id); // Check existence

    return this.prisma.organization.update({
      where: { id },
      data: updateOrganizationDto,
    });
  }

  async updatePlan(id: string, updatePlanDto: UpdateOrganizationPlanDto) {
    const org = await this.findOne(id); // Check existence

    const newPlan = updatePlanDto.plan || org.plan;
    
    let planActiveUntilToSave: Date | null | undefined = undefined;

    if (newPlan === 'FREE') {
       planActiveUntilToSave = null;
    } else {
       if (updatePlanDto.planActiveUntil !== undefined) {
         planActiveUntilToSave = updatePlanDto.planActiveUntil ? new Date(updatePlanDto.planActiveUntil) : null;
       }
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        plan: updatePlanDto.plan,
        planActiveUntil: planActiveUntilToSave,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check existence

    return this.prisma.organization.delete({
      where: { id },
    });
  }
}
