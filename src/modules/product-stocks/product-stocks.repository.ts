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

  async upsert(
    data: { productId: string; location: string; organizationId: string },
    tx?: Prisma.TransactionClient,
  ): Promise<ProductStockEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.productStock.upsert({
      where: {
        productId_location: { productId: data.productId, location: data.location },
      },
      update: {},
      create: {
        organizationId: data.organizationId,
        productId: data.productId,
        location: data.location,
        quantity: 0,
        minQuantity: 0,
      },
    });
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

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<ProductStockEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.productStock.findUnique({ where: { id } });
    return raw ? ProductStockEntity.fromPrisma(raw) : null;
  }

  /** Load multiple stocks by their IDs in a single query (for bulk validation). */
  async findByIds(ids: string[], tx?: Prisma.TransactionClient): Promise<ProductStockEntity[]> {
    const client = tx ?? this.prisma;
    const rows = await client.productStock.findMany({ where: { id: { in: ids } } });
    return rows.map(ProductStockEntity.fromPrisma);
  }

  /**
   * Atomically increment (positive) or decrement (negative) the quantity field.
   * Must be called inside a prisma.$transaction block.
   */
  async incrementQuantity(
    id: string,
    delta: Prisma.Decimal,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.productStock.update({
      where: { id },
      data: { quantity: { increment: delta } },
    });
  }

  async update(
    id: string,
    data: Prisma.ProductStockUncheckedUpdateInput,
    currentEntity?: ProductStockEntity,
  ): Promise<ProductStockEntity> {
    const raw = await this.prisma.productStock.update({
      where: { id },
      data: currentEntity ? { ...data, quantity: currentEntity.quantity } : data,
    });
    return ProductStockEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<ProductStockEntity> {
    const raw = await this.prisma.productStock.delete({ where: { id } });
    return ProductStockEntity.fromPrisma(raw);
  }
}

