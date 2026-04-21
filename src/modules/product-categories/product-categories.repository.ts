import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, ProductCategory } from '@prisma/client';

@Injectable()
export class ProductCategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ProductCategoryUncheckedCreateInput): Promise<ProductCategory> {
    return this.prisma.productCategory.create({ data });
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ProductCategoryWhereInput;
    orderBy?: Prisma.ProductCategoryOrderByWithRelationInput;
  }): Promise<[ProductCategory[], number]> {
    const { skip, take, where, orderBy } = params;
    return Promise.all([
      this.prisma.productCategory.findMany({ skip, take, where, orderBy }),
      this.prisma.productCategory.count({ where }),
    ]);
  }

  async findById(id: string): Promise<ProductCategory | null> {
    return this.prisma.productCategory.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: Prisma.ProductCategoryUncheckedUpdateInput,
  ): Promise<ProductCategory> {
    return this.prisma.productCategory.update({ where: { id }, data });
  }

  async delete(id: string): Promise<ProductCategory> {
    return this.prisma.productCategory.delete({ where: { id } });
  }
}
