import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SupplyStockEntity } from './domain/supply-stock.entity.js';

@Injectable()
export class SupplyStocksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.SupplyStockUncheckedCreateInput): Promise<SupplyStockEntity> {
    const raw = await this.prisma.supplyStock.create({ data });
    return SupplyStockEntity.fromPrisma(raw);
  }

  async upsert(
    data: { supplyId: string; location: string; organizationId: string },
    tx?: Prisma.TransactionClient,
  ): Promise<SupplyStockEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.supplyStock.upsert({
      where: {
        supplyId_location: { supplyId: data.supplyId, location: data.location },
      },
      update: {}, // We don't update anything if it exists
      create: {
        organizationId: data.organizationId,
        supplyId: data.supplyId,
        location: data.location,
        quantity: 0,
        minQuantity: 0,
      },
    });
    return SupplyStockEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SupplyStockWhereInput;
    orderBy?: Prisma.SupplyStockOrderByWithRelationInput;
  }): Promise<[SupplyStockEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.supplyStock.findMany({ skip, take, where, orderBy }),
      this.prisma.supplyStock.count({ where }),
    ]);
    return [rows.map(SupplyStockEntity.fromPrisma), count];
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<SupplyStockEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.supplyStock.findUnique({ where: { id } });
    return raw ? SupplyStockEntity.fromPrisma(raw) : null;
  }

  /** Load multiple stocks by their IDs in a single query (for bulk validation). */
  async findByIds(ids: string[], tx?: Prisma.TransactionClient): Promise<SupplyStockEntity[]> {
    const client = tx ?? this.prisma;
    const rows = await client.supplyStock.findMany({ where: { id: { in: ids } } });
    return rows.map(SupplyStockEntity.fromPrisma);
  }

  /**
   * Atomically increment (positive delta) or decrement (negative delta) the
   * `quantity` field of a SupplyStock record.  Must be called inside a
   * prisma.$transaction block when used with other writes.
   */
  async incrementQuantity(
    id: string,
    delta: Prisma.Decimal,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.supplyStock.update({
      where: { id },
      data: { quantity: { increment: delta } },
    });
  }

  /**
   * Recalculates the SupplyStock quantity based on the ceiling of the sum of all its entries' remaining quantities.
   * This guarantees that the stock only reflects whole physical packages.
   */
  async syncQuantityWithEntries(
    stockId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const entries = await tx.supplyStockEntry.findMany({
      where: { supplyStockId: stockId },
    });

    let totalRemaining = new Prisma.Decimal(0);
    for (const entry of entries) {
      totalRemaining = totalRemaining.plus(entry.remainingQuantity);
    }

    const ceilQuantity = new Prisma.Decimal(Math.ceil(totalRemaining.toNumber()));

    await tx.supplyStock.update({
      where: { id: stockId },
      data: { quantity: ceilQuantity },
    });
  }

  async update(
    id: string,
    data: Prisma.SupplyStockUncheckedUpdateInput,
    currentEntity?: SupplyStockEntity,
  ): Promise<SupplyStockEntity> {
    const raw = await this.prisma.supplyStock.update({
      where: { id },
      data: currentEntity ? { ...data, quantity: currentEntity.quantity } : data,
    });
    return SupplyStockEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<SupplyStockEntity> {
    const raw = await this.prisma.supplyStock.delete({ where: { id } });
    return SupplyStockEntity.fromPrisma(raw);
  }
}

