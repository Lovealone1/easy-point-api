import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DiscountRulesRepository } from './discount-rules.repository.js';
import { CreateDiscountRuleDto } from './dto/create-discount-rule.dto.js';
import { UpdateDiscountRuleDto } from './dto/update-discount-rule.dto.js';
import { FindDiscountRulesDto } from './dto/find-discount-rules.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { DiscountRuleEntity } from './domain/discount-rule.entity.js';
import { Prisma, DiscountScope } from '@prisma/client';

/**
 * DiscountRulesService — capa de aplicación (orquestación).
 *
 * Responsabilidades:
 *  - Resolver el tenant (organizationId).
 *  - Generar código automático si no se provee.
 *  - Validar unicidad del código por organización.
 *  - Coordinar persistencia a través del repository.
 *  - Lanzar excepciones HTTP cuando un recurso no existe o falla una regla.
 *
 * NO contiene lógica de negocio. Toda regla de dominio vive en DiscountRuleEntity.
 */
@Injectable()
export class DiscountRulesService {
  constructor(private readonly discountRulesRepository: DiscountRulesRepository) {}

  async create(
    dto: CreateDiscountRuleDto,
    userId?: string,
  ): Promise<DiscountRuleEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    // Validate CLIENT scope requires clientId
    if (dto.scope === DiscountScope.CLIENT && !dto.clientId) {
      throw new BadRequestException(
        'clientId is required when scope is CLIENT',
      );
    }

    // Generate code if not provided
    const code =
      dto.code?.toUpperCase().trim() ||
      DiscountRuleEntity.generateCode(dto.name, dto.value, dto.type);

    // Ensure code is unique within this org
    const existing = await this.discountRulesRepository.findByCode(
      organizationId,
      code,
    );
    if (existing) {
      throw new ConflictException(
        `A discount rule with code "${code}" already exists in this organization`,
      );
    }

    return this.discountRulesRepository.create({
      organizationId,
      name: dto.name,
      description: dto.description ?? null,
      code,
      type: dto.type,
      value: new Prisma.Decimal(dto.value),
      scope: dto.scope,
      clientId: dto.clientId ?? null,
      category: dto.category,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      maxDiscountAmount:
        dto.maxDiscountAmount !== undefined
          ? new Prisma.Decimal(dto.maxDiscountAmount)
          : null,
      minSaleAmount:
        dto.minSaleAmount !== undefined
          ? new Prisma.Decimal(dto.minSaleAmount)
          : null,
      maxUsages: dto.maxUsages ?? null,
      isActive: dto.isActive ?? true,
      notes: dto.notes ?? null,
      createdByUserId: userId ?? null,
    });
  }

  async findAll(
    query: FindDiscountRulesDto,
  ): Promise<PageDto<DiscountRuleEntity>> {
    const where: Prisma.DiscountRuleWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    // Global admin can pass organizationId as query param
    if (query.organizationId) where.organizationId = query.organizationId;

    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.code) where.code = { contains: query.code, mode: 'insensitive' };
    if (query.type) where.type = query.type;
    if (query.scope) where.scope = query.scope;
    if (query.category) where.category = query.category;
    if (query.clientId) where.clientId = query.clientId;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, count] = await this.discountRulesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: [
        { isActive: 'desc' },
        { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
      ],
    });

    const pageMetaDto = new PageMetaDto({
      itemCount: count,
      pageOptionsDto: query,
    });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<DiscountRuleEntity> {
    const rule = await this.discountRulesRepository.findById(id);
    if (!rule) {
      throw new NotFoundException(`DiscountRule with ID ${id} not found`);
    }
    return rule;
  }

  async findByCode(code: string): Promise<DiscountRuleEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }
    const rule = await this.discountRulesRepository.findByCode(
      organizationId,
      code.toUpperCase().trim(),
    );
    if (!rule) {
      throw new NotFoundException(
        `DiscountRule with code "${code}" not found in this organization`,
      );
    }
    return rule;
  }

  async update(
    id: string,
    dto: UpdateDiscountRuleDto,
  ): Promise<DiscountRuleEntity> {
    const existing = await this.findOne(id);

    if (dto.value !== undefined) {
      const type = existing.type;
      if (type === 'PERCENTAGE' && dto.value > 100) {
        throw new BadRequestException('Para PERCENTAGE el valor máximo es 100');
      }
      if (dto.value < 0) {
        throw new BadRequestException('El valor del descuento debe ser positivo');
      }
    }

    // If code changes, ensure it's unique in this org
    if (dto.code) {
      const organizationId = getTenantId()!;
      const newCode = dto.code.toUpperCase().trim();
      const existing = await this.discountRulesRepository.findByCode(
        organizationId,
        newCode,
      );
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `A discount rule with code "${newCode}" already exists in this organization`,
        );
      }
      dto.code = newCode;
    }

    const updateData: Prisma.DiscountRuleUncheckedUpdateInput = {
      ...dto,
      ...(dto.value !== undefined && {
        value: new Prisma.Decimal(dto.value),
      }),
      ...(dto.maxDiscountAmount !== undefined && {
        maxDiscountAmount:
          dto.maxDiscountAmount !== null
            ? new Prisma.Decimal(dto.maxDiscountAmount)
            : null,
      }),
      ...(dto.minSaleAmount !== undefined && {
        minSaleAmount:
          dto.minSaleAmount !== null
            ? new Prisma.Decimal(dto.minSaleAmount)
            : null,
      }),
      ...(dto.startsAt !== undefined && {
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      }),
      ...(dto.expiresAt !== undefined && {
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    };

    return this.discountRulesRepository.update(id, updateData);
  }

  async toggleActive(
    id: string,
    isActive: boolean,
  ): Promise<DiscountRuleEntity> {
    await this.findOne(id);
    return this.discountRulesRepository.update(id, { isActive });
  }

  async remove(id: string): Promise<DiscountRuleEntity> {
    await this.findOne(id);
    return this.discountRulesRepository.delete(id);
  }
}
