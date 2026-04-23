import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { UpdateOrganizationPlanDto } from './dto/update-organization-plan.dto.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { Prisma, Plan } from '@prisma/client';
import { OrganizationsRepository } from './organizations.repository.js';
import { OrganizationEntity } from './domain/organization.entity.js';

/**
 * Service de Organization — capa de aplicación (orquestación).
 *
 * Responsabilidades:
 *  - Coordinar el flujo entre el repositorio y la entidad de dominio.
 *  - Delegar la lógica de cambio de plan a OrganizationEntity.applyPlanChange().
 *  - Delegar la generación del slug a OrganizationEntity.assignAutoSlug().
 *  - Lanzar NotFoundException cuando un recurso no existe.
 *
 * NO contiene lógica de negocio. Las reglas de plan (FREE → sin fecha)
 * y de slug viven en OrganizationEntity.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
  ) {}

  async create(
    createOrganizationDto: CreateOrganizationDto,
  ): Promise<OrganizationEntity> {
    const entity = new OrganizationEntity({
      id: '',
      name: createOrganizationDto.name,
      slug: createOrganizationDto.slug ?? null,
      email: createOrganizationDto.email ?? null,
      plan: createOrganizationDto.plan ?? Plan.FREE,
      planActiveUntil: null,
      status: createOrganizationDto.status ?? 'ACTIVE',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // La entidad garantiza que el slug siempre existe
    entity.assignAutoSlug();

    return this.organizationsRepository.create({
      name: entity.name,
      slug: entity.slug,
      email: entity.email,
      plan: entity.plan,
      planActiveUntil: entity.planActiveUntil,
      status: entity.status,
      isActive: entity.isActive,
    });
  }

  async findAll(
    pageOptionsDto: PageOptionsDto,
  ): Promise<PageDto<OrganizationEntity>> {
    const skip = pageOptionsDto.skip;
    const take = pageOptionsDto.limit;

    const orderDirection = pageOptionsDto.order
      ? (pageOptionsDto.order.toLowerCase() as Prisma.SortOrder)
      : 'desc';

    const orderBy: Prisma.OrganizationOrderByWithRelationInput =
      pageOptionsDto.orderBy
        ? ({ [pageOptionsDto.orderBy]: orderDirection } as Prisma.OrganizationOrderByWithRelationInput)
        : { createdAt: 'desc' };

    const where: Prisma.OrganizationWhereInput = pageOptionsDto.search
      ? { name: { contains: pageOptionsDto.search, mode: 'insensitive' } }
      : {};

    const [data, itemCount] = await this.organizationsRepository.findManyWithCount({
      skip,
      take,
      orderBy,
      where,
    });

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
    return new PageDto(data, pageMetaDto);
  }

  async findOne(id: string): Promise<OrganizationEntity> {
    const organization = await this.organizationsRepository.findById(id);

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return organization;
  }

  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<OrganizationEntity> {
    await this.findOne(id);
    return this.organizationsRepository.update(id, updateOrganizationDto);
  }

  async updatePlan(
    id: string,
    updatePlanDto: UpdateOrganizationPlanDto,
  ): Promise<OrganizationEntity> {
    const org = await this.findOne(id);

    // La entidad aplica el invariante: FREE → planActiveUntil = null
    const newPlan = updatePlanDto.plan ?? org.plan;
    const newActiveUntil = updatePlanDto.planActiveUntil
      ? new Date(updatePlanDto.planActiveUntil)
      : undefined;

    org.applyPlanChange(newPlan, newActiveUntil);

    return this.organizationsRepository.update(id, {
      plan: org.plan,
      planActiveUntil: org.planActiveUntil,
    });
  }

  async remove(id: string): Promise<OrganizationEntity> {
    await this.findOne(id);
    return this.organizationsRepository.delete(id);
  }
}
