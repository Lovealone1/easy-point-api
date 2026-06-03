import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SupplyMovementEntity } from './domain/supply-movement.entity.js';

const MOVEMENT_INCLUDE = {
  supply: { select: { name: true } },
} satisfies Prisma.SupplyMovementInclude;

@Injectable()
export class SupplyMovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SupplyMovementWhereInput;
    orderBy?: Prisma.SupplyMovementOrderByWithRelationInput;
  }): Promise<[SupplyMovementEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.supplyMovement.findMany({ skip, take, where, orderBy, include: MOVEMENT_INCLUDE }),
      this.prisma.supplyMovement.count({ where }),
    ]);
    return [rows.map(row => SupplyMovementEntity.fromPrisma(row as any)), count];
  }

  /**
   * Bulk-insert supply movements.
   * Always pass `tx` when called from an outer prisma.$transaction block.
   */
  async createMany(
    data: Prisma.SupplyMovementUncheckedCreateInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const result = await client.supplyMovement.createMany({ data });
    return result.count;
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<SupplyMovementEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.supplyMovement.findUnique({ where: { id }, include: MOVEMENT_INCLUDE });
    return raw ? SupplyMovementEntity.fromPrisma(raw as any) : null;
  }
}
