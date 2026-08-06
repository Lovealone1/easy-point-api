import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, UserSubscriptionStatus } from '@prisma/client';
import { UserSubscriptionEntity } from './domain/user-subscription.entity.js';

const INCLUDE = {
  provider: { include: { category: true } },
  customCategory: true,
  card: true,
} satisfies Prisma.UserSubscriptionInclude;

@Injectable()
export class UserSubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where: Prisma.UserSubscriptionWhereInput;
    orderBy?: Prisma.UserSubscriptionOrderByWithRelationInput;
  }): Promise<[UserSubscriptionEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.userSubscription.findMany({ skip, take, where, orderBy, include: INCLUDE }),
      this.prisma.userSubscription.count({ where }),
    ]);
    return [rows.map(UserSubscriptionEntity.fromPrisma), count];
  }

  async findByIdAndUser(id: string, userId: string): Promise<UserSubscriptionEntity | null> {
    const raw = await this.prisma.userSubscription.findFirst({
      where: { id, userId },
      include: INCLUDE,
    });
    return raw ? UserSubscriptionEntity.fromPrisma(raw) : null;
  }

  async findAllActiveForUser(userId: string): Promise<UserSubscriptionEntity[]> {
    const rows = await this.prisma.userSubscription.findMany({
      where: { userId, status: { in: [UserSubscriptionStatus.ACTIVE, UserSubscriptionStatus.PAUSED] } },
      include: INCLUDE,
    });
    return rows.map(UserSubscriptionEntity.fromPrisma);
  }

  async create(data: Prisma.UserSubscriptionCreateInput): Promise<UserSubscriptionEntity> {
    const raw = await this.prisma.userSubscription.create({ data, include: INCLUDE });
    return UserSubscriptionEntity.fromPrisma(raw);
  }

  async update(id: string, data: Prisma.UserSubscriptionUpdateInput): Promise<UserSubscriptionEntity> {
    const raw = await this.prisma.userSubscription.update({ where: { id }, data, include: INCLUDE });
    return UserSubscriptionEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<UserSubscriptionEntity> {
    const raw = await this.prisma.userSubscription.delete({ where: { id }, include: INCLUDE });
    return UserSubscriptionEntity.fromPrisma(raw);
  }
}
