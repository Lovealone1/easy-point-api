import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { UpdateOrganizationPlanDto } from './dto/update-organization-plan.dto.js';
import { CreateMyOrganizationDto } from './dto/create-my-organization.dto.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { Prisma } from '@prisma/client';
import { OrganizationsRepository } from './organizations.repository.js';
import { OrganizationEntity } from './domain/organization.entity.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import {
  ADMIN_DEFAULT_MODULE_KEYS,
  BASE_MODULES_SELECTION_SIZE,
} from './domain/base-modules.constants.js';

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
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async create(
    createOrganizationDto: CreateOrganizationDto,
  ): Promise<OrganizationEntity> {
    const entity = new OrganizationEntity({
      id: '',
      name: createOrganizationDto.name,
      slug: createOrganizationDto.slug ?? null,
      email: createOrganizationDto.email ?? null,
      plan: createOrganizationDto.plan ?? 'FREE',
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
    const updated = await this.organizationsRepository.update(id, updateOrganizationDto);
    
    // Invalidate config cache
    try {
      await this.redisCacheService.delete(`org_config:${id}`);
    } catch (error) {
      console.error('Failed to invalidate organization config cache:', error);
    }
    
    return updated;
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

    const updated = await this.organizationsRepository.update(id, {
      plan: org.plan,
      planActiveUntil: org.planActiveUntil,
    });

    // Invalidate config cache
    try {
      await this.redisCacheService.delete(`org_config:${id}`);
    } catch (error) {
      console.error('Failed to invalidate organization config cache:', error);
    }

    return updated;
  }

  async remove(id: string): Promise<OrganizationEntity> {
    await this.findOne(id);
    const deleted = await this.organizationsRepository.delete(id);

    // Invalidate config cache
    try {
      await this.redisCacheService.delete(`org_config:${id}`);
    } catch (error) {
      console.error('Failed to invalidate organization config cache:', error);
    }

    return deleted;
  }

  // ---------------------------------------------------------------------------
  // Self-service organization creation (any authenticated user, org-less)
  // ---------------------------------------------------------------------------

  /**
   * Catalog for the self-service "create your organization" flow: the
   * admin-governance modules (always on, not selectable) split from the
   * modules the user may choose their 5 base modules from.
   */
  async getSelfServiceCatalog(): Promise<{
    selectionSize: number;
    defaultModules: Array<{ id: string; key: string; name: string; description: string | null; icon: string | null }>;
    selectableModules: Array<{ id: string; key: string; name: string; description: string | null; icon: string | null }>;
  }> {
    const modules = await this.organizationsRepository.findActiveModules();

    const project = (m: (typeof modules)[number]) => ({
      id: m.id,
      key: m.key,
      name: m.name,
      description: m.description,
      icon: m.icon,
    });

    return {
      selectionSize: BASE_MODULES_SELECTION_SIZE,
      defaultModules: modules
        .filter((m) => (ADMIN_DEFAULT_MODULE_KEYS as readonly string[]).includes(m.key))
        .map(project),
      selectableModules: modules
        .filter((m) => !(ADMIN_DEFAULT_MODULE_KEYS as readonly string[]).includes(m.key))
        .map(project),
    };
  }

  /**
   * Creates an organization on behalf of an org-less authenticated user.
   * Always FREE tier, always OWNER for the creator, always the 7
   * admin-governance modules plus exactly 5 user-chosen modules.
   */
  async createForUser(
    userId: string,
    dto: CreateMyOrganizationDto,
  ): Promise<OrganizationEntity> {
    const existingMemberships =
      await this.organizationsRepository.countMembershipsForUser(userId);
    if (existingMemberships > 0) {
      throw new ConflictException('Ya perteneces a una organización.');
    }

    const activeModules = await this.organizationsRepository.findActiveModules();
    const activeModuleIds = new Set(activeModules.map((m) => m.id));
    const adminDefaultModuleIds = activeModules
      .filter((m) => (ADMIN_DEFAULT_MODULE_KEYS as readonly string[]).includes(m.key))
      .map((m) => m.id);

    const uniqueChosenIds = new Set(dto.moduleIds);
    if (uniqueChosenIds.size !== dto.moduleIds.length) {
      throw new BadRequestException('No se puede seleccionar el mismo módulo más de una vez.');
    }
    if (uniqueChosenIds.size !== BASE_MODULES_SELECTION_SIZE) {
      throw new BadRequestException(
        `Debes seleccionar exactamente ${BASE_MODULES_SELECTION_SIZE} módulos base.`,
      );
    }

    for (const moduleId of uniqueChosenIds) {
      if (!activeModuleIds.has(moduleId)) {
        throw new BadRequestException(`El módulo '${moduleId}' no existe o no está activo.`);
      }
      if (adminDefaultModuleIds.includes(moduleId)) {
        throw new BadRequestException(
          'Los módulos de administración ya están incluidos por defecto; no deben seleccionarse.',
        );
      }
    }

    const entity = new OrganizationEntity({
      id: '',
      name: dto.name,
      slug: null,
      email: dto.email ?? null,
      plan: 'FREE',
      planActiveUntil: null,
      status: 'ACTIVE',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    entity.assignAutoSlug();
    entity.slug = await this.organizationsRepository.resolveUniqueSlug(entity.slug!);

    return this.organizationsRepository.create(
      {
        name: entity.name,
        slug: entity.slug,
        email: entity.email,
        plan: entity.plan,
        planActiveUntil: entity.planActiveUntil,
        status: entity.status,
        isActive: entity.isActive,
      },
      {
        moduleIds: [...adminDefaultModuleIds, ...uniqueChosenIds],
        ownerUserId: userId,
      },
    );
  }
}
