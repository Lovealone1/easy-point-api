import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { InventoryMovementEntity } from './domain/inventory-movement.entity.js';

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
      this.prisma.inventoryMovement.findMany({ skip, take, where, orderBy }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return [rows.map(InventoryMovementEntity.fromPrisma), count];
  }
}
