import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { InventoryMovementEntity } from './domain/inventory-movement.entity.js';

const MOVEMENT_INCLUDE = {
  product: { select: { name: true } },
} satisfies Prisma.InventoryMovementInclude;

@Injectable()
export class InventoryMovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.InventoryMovementWhereInput;
    orderBy?: Prisma.InventoryMovementOrderByWithRelationInput;
  }): Promise<[InventoryMovementEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.inventoryMovement.findMany({ skip, take, where, orderBy, include: MOVEMENT_INCLUDE }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return [rows.map(InventoryMovementEntity.fromPrisma), count];
  }

  /**
   * Bulk-insert inventory movements.
   * Always pass `tx` when called from an outer prisma.$transaction block.
   */
  async createMany(
    data: Prisma.InventoryMovementUncheckedCreateInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const result = await client.inventoryMovement.createMany({ data });
    return result.count;
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<InventoryMovementEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.inventoryMovement.findUnique({ where: { id }, include: MOVEMENT_INCLUDE });
    return raw ? InventoryMovementEntity.fromPrisma(raw) : null;
  }
}

