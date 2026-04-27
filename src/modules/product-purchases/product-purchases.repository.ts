import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { ProductPurchaseEntity } from './domain/product-purchase.entity.js';

@Injectable()
export class ProductPurchasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.ProductPurchaseUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ProductPurchaseEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.productPurchase.create({ data });
    return ProductPurchaseEntity.fromPrisma(raw);
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<ProductPurchaseEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.productPurchase.findUnique({ where: { id } });
    return raw ? ProductPurchaseEntity.fromPrisma(raw) : null;
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ProductPurchaseWhereInput;
    orderBy?: Prisma.ProductPurchaseOrderByWithRelationInput;
  }): Promise<[ProductPurchaseEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.productPurchase.findMany({ skip, take, where, orderBy }),
      this.prisma.productPurchase.count({ where }),
    ]);
    return [rows.map(ProductPurchaseEntity.fromPrisma), count];
  }

  async update(
    id: string,
    data: Prisma.ProductPurchaseUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ProductPurchaseEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.productPurchase.update({ where: { id }, data });
    return ProductPurchaseEntity.fromPrisma(raw);
  }
}
