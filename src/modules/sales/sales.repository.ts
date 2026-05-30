import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SaleEntity } from './domain/sale.entity.js';

/** Shared include clause so every query returns the client name and user email. */
const SALE_INCLUDE = {
  client: { select: { name: true } },
  performedBy: { select: { email: true } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.SaleUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SaleEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.sale.create({ data, include: SALE_INCLUDE });
    return SaleEntity.fromPrisma(raw);
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<SaleEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.sale.findUnique({ where: { id }, include: SALE_INCLUDE });
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
      this.prisma.sale.findMany({ skip, take, where, orderBy, include: SALE_INCLUDE }),
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
    const raw = await client.sale.update({ where: { id }, data, include: SALE_INCLUDE });
    return SaleEntity.fromPrisma(raw);
  }
}
