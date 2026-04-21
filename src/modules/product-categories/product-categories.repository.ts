import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { ProductCategoryEntity } from './domain/product-category.entity.js';

/**
 * Repository de ProductCategory — capa de infraestructura.
 *
 * Responsabilidades:
 *  - Toda comunicación con la base de datos (Prisma).
 *  - Mapeo entre el modelo Prisma y la entidad de dominio ProductCategoryEntity.
 *
 * NO contiene lógica de negocio.
 */
@Injectable()
export class ProductCategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.ProductCategoryUncheckedCreateInput,
  ): Promise<ProductCategoryEntity> {
    const raw = await this.prisma.productCategory.create({ data });
    return ProductCategoryEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ProductCategoryWhereInput;
    orderBy?: Prisma.ProductCategoryOrderByWithRelationInput;
  }): Promise<[ProductCategoryEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.productCategory.findMany({ skip, take, where, orderBy }),
      this.prisma.productCategory.count({ where }),
    ]);
    return [rows.map(ProductCategoryEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<ProductCategoryEntity | null> {
    const raw = await this.prisma.productCategory.findUnique({ where: { id } });
    return raw ? ProductCategoryEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.ProductCategoryUncheckedUpdateInput,
  ): Promise<ProductCategoryEntity> {
    const raw = await this.prisma.productCategory.update({ where: { id }, data });
    return ProductCategoryEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<ProductCategoryEntity> {
    const raw = await this.prisma.productCategory.delete({ where: { id } });
    return ProductCategoryEntity.fromPrisma(raw);
  }
}
