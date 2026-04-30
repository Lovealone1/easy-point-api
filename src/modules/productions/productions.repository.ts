import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { ProductionEntity } from './domain/production.entity.js';

//TODO: Testear módulo de producciones

@Injectable()
export class ProductionsRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(
    data: Prisma.ProductionUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ProductionEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.production.create({ data });
    return ProductionEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ProductionWhereInput;
    orderBy?: Prisma.ProductionOrderByWithRelationInput;
  }): Promise<[ProductionEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.production.findMany({ skip, take, where, orderBy }),
      this.prisma.production.count({ where }),
    ]);
    return [rows.map(ProductionEntity.fromPrisma), count];
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<ProductionEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.production.findUnique({ where: { id } });
    return raw ? ProductionEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.ProductionUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ProductionEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.production.update({ where: { id }, data });
    return ProductionEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<ProductionEntity> {
    const raw = await this.prisma.production.delete({ where: { id } });
    return ProductionEntity.fromPrisma(raw);
  }
}
