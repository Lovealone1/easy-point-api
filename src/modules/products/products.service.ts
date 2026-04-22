import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ProductsRepository } from './products.repository.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { FindProductsDto } from './dto/find-products.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { ProductEntity } from './domain/product.entity.js';
import { Prisma } from '@prisma/client';

/**
 * Service de Product — capa de aplicación (orquestación).
 *
 * Responsabilidades:
 *  - Resolver el contexto de tenant (organizationId).
 *  - Obtener datos de apoyo necesarios para la entidad (org.name, categoryCode, sequential).
 *  - Delegar la generación del SKU a la entidad (ProductEntity.assignAutoSku).
 *  - Coordinar el flujo entre el repositorio y la entidad de dominio.
 *  - Traducir errores de Prisma (P2002 duplicate SKU) a errores HTTP.
 *  - Lanzar NotFoundException cuando un recurso no existe.
 *
 * NO contiene lógica de negocio. Las reglas de SKU, notas y margen viven en ProductEntity.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly organizationsRepository: OrganizationsRepository,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<ProductEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    // Obtener la organización para usar su nombre en la generación del SKU
    const organization = await this.organizationsRepository.findById(organizationId);
    if (!organization) {
      throw new BadRequestException(
        `Organization with ID "${organizationId}" does not exist`,
      );
    }

    // Calcular el sequential para el SKU (total de productos en org+categoría + 1)
    const sequential =
      (await this.productsRepository.countByOrgAndCategory(
        organizationId,
        createProductDto.categoryId ?? null,
      )) + 1;

    // Construir la entidad con los datos del DTO y asignar el SKU si no viene explícito
    // La categoría solo provee su código (3 letras). Si no hay categoría se usará 'GEN'.
    // El código de categoría lo tenemos en el DTO si existe; para obtener el código real
    // debemos consultar la categoria. Para simplificar, el SKU util acepta el code directo.
    // El service delega en la entidad cuándo y cómo llamar a generateSku.
    const entity = new ProductEntity({
      id: '',
      name: createProductDto.name,
      description: createProductDto.description ?? null,
      sku: createProductDto.sku ?? null,
      barcode: createProductDto.barcode ?? null,
      salePrice: new Prisma.Decimal(createProductDto.salePrice),
      costPrice: createProductDto.costPrice != null
        ? new Prisma.Decimal(createProductDto.costPrice)
        : null,
      categoryId: createProductDto.categoryId ?? null,
      isPurchased: createProductDto.isPurchased ?? false,
      recipeId: null,
      imageUrl: createProductDto.imageUrl ?? null,
      notes: createProductDto.notes ?? null,
      isActive: true,
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // La entidad decide si genera el SKU (solo si no fue provisto manualmente).
    // categoryCode: se pasa null aquí porque solo tenemos el categoryId, no el code.
    // El SKU builder usará 'GEN' como fallback cuando no hay categoría.
    // Si en el futuro se quiere el code real, el service puede consultar ProductCategoriesRepository.
    entity.assignAutoSku(organization.name, null, sequential);

    // Una vez que el SKU está asignado (manual o automático), la entidad genera
    // el barcode EAN-13 numérico si el producto no trajo uno manualmente.
    entity.assignAutoBarcode();

    try {
      return await this.productsRepository.create({
        name: entity.name,
        description: entity.description,
        sku: entity.sku,
        barcode: entity.barcode,
        salePrice: entity.salePrice,
        costPrice: entity.costPrice ?? undefined,
        categoryId: entity.categoryId ?? undefined,
        isPurchased: entity.isPurchased,
        imageUrl: entity.imageUrl,
        notes: entity.notes,
        isActive: entity.isActive,
        organizationId: entity.organizationId,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `A product with SKU "${entity.sku}" already exists in this organization`,
        );
      }
      throw err;
    }
  }

  async findAll(query: FindProductsDto): Promise<PageDto<ProductEntity>> {
    const where: Prisma.ProductWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    // El admin global puede pasar organizationId como query param para filtrar
    if (query.organizationId) where.organizationId = query.organizationId;

    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.sku) where.sku = { contains: query.sku, mode: 'insensitive' };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.isPurchased !== undefined) where.isPurchased = query.isPurchased;

    const [items, count] = await this.productsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<ProductEntity> {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductEntity> {
    await this.findOne(id);
    try {
      return await this.productsRepository.update(id, {
        ...updateProductDto,
        ...(updateProductDto.salePrice != null && {
          salePrice: new Prisma.Decimal(updateProductDto.salePrice),
        }),
        ...(updateProductDto.costPrice != null && {
          costPrice: new Prisma.Decimal(updateProductDto.costPrice),
        }),
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A product with that SKU already exists in this organization',
        );
      }
      throw err;
    }
  }

  async remove(id: string): Promise<ProductEntity> {
    await this.findOne(id);
    return this.productsRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<ProductEntity> {
    await this.findOne(id);
    return this.productsRepository.update(id, { isActive });
  }

  async addNote(id: string, note: string): Promise<ProductEntity> {
    const product = await this.findOne(id);

    // La entidad aplica la lógica de concatenación — el service solo orquesta
    product.appendNote(note);

    return this.productsRepository.update(id, { notes: product.notes });
  }
}
