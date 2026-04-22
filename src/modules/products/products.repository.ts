import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { ProductEntity } from './domain/product.entity.js';

/**
 * Repository de Product — capa de infraestructura.
 *
 * Responsabilidades:
 *  - Toda comunicación con la base de datos (Prisma).
 *  - Mapeo entre el modelo Prisma y la entidad de dominio ProductEntity.
 *
 * NO contiene lógica de negocio.
 */
@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.ProductUncheckedCreateInput,
  ): Promise<ProductEntity> {
    const raw = await this.prisma.product.create({ data });
    return ProductEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ProductWhereInput;
    orderBy?: Prisma.ProductOrderByWithRelationInput;
  }): Promise<[ProductEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.product.findMany({ skip, take, where, orderBy }),
      this.prisma.product.count({ where }),
    ]);
    return [rows.map(ProductEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<ProductEntity | null> {
    const raw = await this.prisma.product.findUnique({ where: { id } });
    return raw ? ProductEntity.fromPrisma(raw) : null;
  }

  /**
   * Busca un producto incluyendo el nombre de su categoría en el mismo SELECT (JOIN único).
   * Usado por RecipesService para auto-poblar Recipe.category sin queries adicionales.
   */
  async findByIdWithCategory(
    id: string,
  ): Promise<{ entity: ProductEntity; categoryName: string | null } | null> {
    const raw = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { name: true } } },
    });
    if (!raw) return null;
    return {
      entity: ProductEntity.fromPrisma(raw),
      categoryName: raw.category?.name ?? null,
    };
  }

  async update(
    id: string,
    data: Prisma.ProductUncheckedUpdateInput,
  ): Promise<ProductEntity> {
    const raw = await this.prisma.product.update({ where: { id }, data });
    return ProductEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<ProductEntity> {
    const raw = await this.prisma.product.delete({ where: { id } });
    return ProductEntity.fromPrisma(raw);
  }

  /**
   * Cuenta cuántos productos existen en una organización para una categoría dada.
   * Usado para calcular el número secuencial del SKU.
   */
  async countByOrgAndCategory(
    organizationId: string,
    categoryId: string | null,
  ): Promise<number> {
    return this.prisma.product.count({
      where: { organizationId, categoryId: categoryId ?? undefined },
    });
  }

  /**
   * Vincula (o desvincula) un producto a una receta.
   * Usado por RecipesService al crear una receta con productId.
   */
  async linkRecipe(
    productId: string,
    recipeId: string | null,
  ): Promise<ProductEntity> {
    const raw = await this.prisma.product.update({
      where: { id: productId },
      data: { recipeId },
    });
    return ProductEntity.fromPrisma(raw);
  }
}

