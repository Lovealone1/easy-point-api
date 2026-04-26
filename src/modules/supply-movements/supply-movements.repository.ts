import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SupplyMovementEntity } from './domain/supply-movement.entity.js';

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
      this.prisma.supplyMovement.findMany({ skip, take, where, orderBy }),
      this.prisma.supplyMovement.count({ where }),
    ]);
    return [rows.map(SupplyMovementEntity.fromPrisma), count];
  }
}
