import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SubscriptionEntity } from './domain/subscription.entity.js';

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.SubscriptionUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<SubscriptionEntity> {
    const prismaClient = tx || this.prisma;
    const raw = await prismaClient.subscription.create({
      data,
      include: { plan: true },
    });
    return SubscriptionEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SubscriptionWhereInput;
    orderBy?: Prisma.SubscriptionOrderByWithRelationInput;
  }, tx?: Prisma.TransactionClient): Promise<[SubscriptionEntity[], number]> {
    const prismaClient = tx || this.prisma;
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      prismaClient.subscription.findMany({
        skip,
        take,
        where,
        orderBy,
        include: { plan: true },
      }),
      prismaClient.subscription.count({ where }),
    ]);
    return [rows.map(SubscriptionEntity.fromPrisma), count];
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<SubscriptionEntity | null> {
    const prismaClient = tx || this.prisma;
    const raw = await prismaClient.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });
    return raw ? SubscriptionEntity.fromPrisma(raw) : null;
  }

  async findActiveByOrganizationId(organizationId: string, tx?: Prisma.TransactionClient): Promise<SubscriptionEntity | null> {
    const prismaClient = tx || this.prisma;
    const raw = await prismaClient.subscription.findFirst({
      where: { organizationId, status: 'ACTIVE' },
      include: { plan: true },
    });
    return raw ? SubscriptionEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.SubscriptionUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SubscriptionEntity> {
    const prismaClient = tx || this.prisma;
    const raw = await prismaClient.subscription.update({
      where: { id },
      data,
      include: { plan: true },
    });
    return SubscriptionEntity.fromPrisma(raw);
  }

  async delete(id: string, tx?: Prisma.TransactionClient): Promise<SubscriptionEntity> {
    const prismaClient = tx || this.prisma;
    const raw = await prismaClient.subscription.delete({
      where: { id },
      include: { plan: true },
    });
    return SubscriptionEntity.fromPrisma(raw);
  }
}
