import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { PlanEntity } from './domain/plan.entity.js';

@Injectable()
export class PlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.PlanCreateInput): Promise<PlanEntity> {
    const raw = await this.prisma.plan.create({ data });
    return PlanEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PlanWhereInput;
    orderBy?: Prisma.PlanOrderByWithRelationInput;
  }): Promise<[PlanEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.plan.findMany({ skip, take, where, orderBy }),
      this.prisma.plan.count({ where }),
    ]);
    return [rows.map(PlanEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<PlanEntity | null> {
    const raw = await this.prisma.plan.findUnique({ where: { id } });
    return raw ? PlanEntity.fromPrisma(raw) : null;
  }

  async findByName(name: string): Promise<PlanEntity | null> {
    const raw = await this.prisma.plan.findUnique({ where: { name } });
    return raw ? PlanEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.PlanUpdateInput,
  ): Promise<PlanEntity> {
    const raw = await this.prisma.plan.update({ where: { id }, data });
    return PlanEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<PlanEntity> {
    const raw = await this.prisma.plan.delete({ where: { id } });
    return PlanEntity.fromPrisma(raw);
  }
}
