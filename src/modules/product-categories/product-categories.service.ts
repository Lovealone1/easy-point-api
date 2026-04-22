import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductCategoriesRepository } from './product-categories.repository.js';
import { CreateProductCategoryDto } from './dto/create-product-category.dto.js';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto.js';
import { FindProductCategoriesDto } from './dto/find-product-categories.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { ProductCategoryEntity } from './domain/product-category.entity.js';
import { Prisma } from '@prisma/client';

/**
 * Service de ProductCategory — capa de aplicación (orquestación).
 *
 * Responsabilidades:
 *  - Resolver el contexto de tenant (organizationId).
 *  - Coordinar el flujo entre el repositorio y la entidad de dominio.
 *  - Traducir errores de infraestructura (Prisma P2002/P2003) a errores HTTP.
 *  - Lanzar excepciones HTTP cuando un recurso no existe.
 *
 * NO contiene lógica de negocio. Las reglas de normalización viven en ProductCategoryEntity.
 */
@Injectable()
export class ProductCategoriesService {
  constructor(
    private readonly productCategoriesRepository: ProductCategoriesRepository,
  ) {}

  async create(
    createProductCategoryDto: CreateProductCategoryDto,
  ): Promise<ProductCategoryEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    try {
      return await this.productCategoriesRepository.create({
        ...createProductCategoryDto,
        organizationId,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2003') {
          throw new BadRequestException(
            `Organization with ID "${organizationId}" does not exist`,
          );
        }
        if (err.code === 'P2002') {
          throw new BadRequestException(
            `A category with code "${createProductCategoryDto.code.toUpperCase()}" already exists in this organization`,
          );
        }
      }
      throw err;
    }
  }

  async findAll(
    query: FindProductCategoriesDto,
  ): Promise<PageDto<ProductCategoryEntity>> {
    const where: Prisma.ProductCategoryWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.code) where.code = { contains: query.code, mode: 'insensitive' };
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, count] = await this.productCategoriesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<ProductCategoryEntity> {
    const category = await this.productCategoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`ProductCategory with ID ${id} not found`);
    }
    return category;
  }

  async update(
    id: string,
    updateProductCategoryDto: UpdateProductCategoryDto,
  ): Promise<ProductCategoryEntity> {
    await this.findOne(id);
    try {
      return await this.productCategoriesRepository.update(
        id,
        updateProductCategoryDto,
      );
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `A category with that code already exists in this organization`,
        );
      }
      throw err;
    }
  }

  async remove(id: string): Promise<ProductCategoryEntity> {
    await this.findOne(id);
    return this.productCategoriesRepository.delete(id);
  }

  async toggleActive(
    id: string,
    isActive: boolean,
  ): Promise<ProductCategoryEntity> {
    await this.findOne(id);
    return this.productCategoriesRepository.update(id, { isActive });
  }
}
