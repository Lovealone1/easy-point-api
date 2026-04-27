import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SaleEntity } from './domain/sale.entity.js';

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.SaleUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SaleEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.sale.create({ data });
    return SaleEntity.fromPrisma(raw);
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<SaleEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.sale.findUnique({ where: { id } });
    return raw ? SaleEntity.fromPrisma(raw) : null;
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SaleWhereInput;
    orderBy?: Prisma.SaleOrderByWithRelationInput;
  }): Promise<[SaleEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.sale.findMany({ skip, take, where, orderBy }),
      this.prisma.sale.count({ where }),
    ]);
    return [rows.map(SaleEntity.fromPrisma), count];
  }

  async update(
    id: string,
    data: Prisma.SaleUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SaleEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.sale.update({ where: { id }, data });
    return SaleEntity.fromPrisma(raw);
  }
}
