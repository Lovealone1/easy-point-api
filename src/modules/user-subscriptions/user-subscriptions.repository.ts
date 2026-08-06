import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, UserSubscriptionStatus } from '@prisma/client';
import { UserSubscriptionEntity } from './domain/user-subscription.entity.js';

const INCLUDE = {
  provider: { include: { category: true } },
  customCategory: true,
  card: true,
} satisfies Prisma.UserSubscriptionInclude;

export interface PriceSnapshotInput {
  amount: Prisma.Decimal;
  currency: string;
  effectiveFrom: Date;
}

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

  /** Active subscriptions with their usage logs — feeds the zombie list and the cash-flow calendar. */
  async findAllActiveWithUsageLogsForUser(userId: string): Promise<
    Array<UserSubscriptionEntity & { usageLogs: Array<{ date: Date; used: boolean }> }>
  > {
    const rows = await this.prisma.userSubscription.findMany({
      where: { userId, status: UserSubscriptionStatus.ACTIVE },
      include: { ...INCLUDE, usageLogs: { select: { date: true, used: true } } },
    });
    return rows.map((row) => {
      const { usageLogs, ...rest } = row;
      return Object.assign(UserSubscriptionEntity.fromPrisma(rest), { usageLogs });
    });
  }

  async create(data: Prisma.UserSubscriptionCreateInput, initialSnapshot: PriceSnapshotInput): Promise<UserSubscriptionEntity> {
    const raw = await this.prisma.userSubscription.create({ data, include: INCLUDE });
    await this.prisma.userSubscriptionPriceHistory.create({
      data: {
        userSubscriptionId: raw.id,
        amount: initialSnapshot.amount,
        currency: initialSnapshot.currency,
        effectiveFrom: initialSnapshot.effectiveFrom,
      },
    });
    return UserSubscriptionEntity.fromPrisma(raw);
  }

  async update(
    id: string,
    data: Prisma.UserSubscriptionUpdateInput,
    priceSnapshot?: PriceSnapshotInput,
  ): Promise<UserSubscriptionEntity> {
    if (priceSnapshot) {
      await this.prisma.userSubscriptionPriceHistory.create({
        data: {
          userSubscriptionId: id,
          amount: priceSnapshot.amount,
          currency: priceSnapshot.currency,
          effectiveFrom: priceSnapshot.effectiveFrom,
        },
      });
    }
    const raw = await this.prisma.userSubscription.update({ where: { id }, data, include: INCLUDE });
    return UserSubscriptionEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<UserSubscriptionEntity> {
    const raw = await this.prisma.userSubscription.delete({ where: { id }, include: INCLUDE });
    return UserSubscriptionEntity.fromPrisma(raw);
  }

  // Price history

  async findPriceHistory(userSubscriptionId: string): Promise<Array<{ id: string; amount: Prisma.Decimal; currency: string; effectiveFrom: Date; createdAt: Date }>> {
    return this.prisma.userSubscriptionPriceHistory.findMany({
      where: { userSubscriptionId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async findLatestTwoPriceSnapshots(userSubscriptionId: string): Promise<Array<{ amount: Prisma.Decimal; currency: string; createdAt: Date }>> {
    return this.prisma.userSubscriptionPriceHistory.findMany({
      where: { userSubscriptionId },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { amount: true, currency: true, createdAt: true },
    });
  }

  // Usage check-ins

  async upsertUsageCheckin(userSubscriptionId: string, date: Date, used: boolean): Promise<{ id: string; date: Date; used: boolean }> {
    return this.prisma.userSubscriptionUsageLog.upsert({
      where: { userSubscriptionId_date: { userSubscriptionId, date } },
      update: { used },
      create: { userSubscriptionId, date, used },
    });
  }

  async findUsageCheckins(userSubscriptionId: string, from: Date, to: Date): Promise<Array<{ date: Date; used: boolean }>> {
    return this.prisma.userSubscriptionUsageLog.findMany({
      where: { userSubscriptionId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      select: { date: true, used: true },
    });
  }

  async findAllUsageLogs(userSubscriptionId: string): Promise<Array<{ date: Date; used: boolean }>> {
    return this.prisma.userSubscriptionUsageLog.findMany({
      where: { userSubscriptionId },
      select: { date: true, used: true },
    });
  }
}
