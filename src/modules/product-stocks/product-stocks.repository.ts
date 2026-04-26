import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { ProductStockEntity } from './domain/product-stock.entity.js';

@Injectable()
export class ProductStocksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ProductStockUncheckedCreateInput): Promise<ProductStockEntity> {
    const raw = await this.prisma.productStock.create({ data });
    return ProductStockEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ProductStockWhereInput;
    orderBy?: Prisma.ProductStockOrderByWithRelationInput;
  }): Promise<[ProductStockEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.productStock.findMany({ skip, take, where, orderBy }),
      this.prisma.productStock.count({ where }),
    ]);
    return [rows.map(ProductStockEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<ProductStockEntity | null> {
    const raw = await this.prisma.productStock.findUnique({ where: { id } });
    return raw ? ProductStockEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.ProductStockUncheckedUpdateInput,
    currentEntity?: ProductStockEntity
  ): Promise<ProductStockEntity> {
    const raw = await this.prisma.productStock.update({ 
      where: { id }, 
      data: currentEntity ? { ...data, quantity: currentEntity.quantity } : data 
    });
    return ProductStockEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<ProductStockEntity> {
    const raw = await this.prisma.productStock.delete({ where: { id } });
    return ProductStockEntity.fromPrisma(raw);
  }
}
