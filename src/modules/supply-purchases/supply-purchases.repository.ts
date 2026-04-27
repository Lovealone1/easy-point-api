import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SupplyPurchaseEntity } from './domain/supply-purchase.entity.js';

@Injectable()
export class SupplyPurchasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.SupplyPurchaseUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplyPurchaseEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.supplyPurchase.create({ data });
    return SupplyPurchaseEntity.fromPrisma(raw);
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<SupplyPurchaseEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.supplyPurchase.findUnique({ where: { id } });
    return raw ? SupplyPurchaseEntity.fromPrisma(raw) : null;
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SupplyPurchaseWhereInput;
    orderBy?: Prisma.SupplyPurchaseOrderByWithRelationInput;
  }): Promise<[SupplyPurchaseEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.supplyPurchase.findMany({ skip, take, where, orderBy }),
      this.prisma.supplyPurchase.count({ where }),
    ]);
    return [rows.map(SupplyPurchaseEntity.fromPrisma), count];
  }

  async update(
    id: string,
    data: Prisma.SupplyPurchaseUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplyPurchaseEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.supplyPurchase.update({ where: { id }, data });
    return SupplyPurchaseEntity.fromPrisma(raw);
  }
}
