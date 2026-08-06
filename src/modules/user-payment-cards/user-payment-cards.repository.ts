import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, UserSubscriptionStatus } from '@prisma/client';
import { UserPaymentCardEntity } from './domain/user-payment-card.entity.js';
import { toMonthlyAmount } from '../user-subscriptions/domain/billing-cycle.helper.js';

@Injectable()
export class UserPaymentCardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUser(userId: string): Promise<UserPaymentCardEntity[]> {
    const rows = await this.prisma.userPaymentCard.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        subscriptions: {
          where: { status: UserSubscriptionStatus.ACTIVE },
          select: { id: true, amount: true, currency: true, billingCycle: true },
        },
      },
    });

    return rows.map((row) => {
      const { subscriptions, ...card } = row;
      // Simplification: sums normalized-to-monthly amounts across currencies
      // without conversion (all active subscriptions are expected to share
      // the same currency in practice). Multi-currency breakdown belongs to
      // the /me/subscriptions/summary endpoint, which groups by currency.
      const monthlyTotal = subscriptions.reduce(
        (acc, sub) => acc.add(toMonthlyAmount(sub.amount, sub.billingCycle)),
        new Prisma.Decimal(0),
      );

      return new UserPaymentCardEntity({
        ...card,
        subscriptionCount: subscriptions.length,
        monthlyTotal: monthlyTotal.toFixed(2),
      });
    });
  }

  async findById(id: string): Promise<UserPaymentCardEntity | null> {
    const raw = await this.prisma.userPaymentCard.findUnique({ where: { id } });
    return raw ? UserPaymentCardEntity.fromPrisma(raw) : null;
  }

  async findByIdAndUser(id: string, userId: string): Promise<UserPaymentCardEntity | null> {
    const raw = await this.prisma.userPaymentCard.findFirst({ where: { id, userId } });
    return raw ? UserPaymentCardEntity.fromPrisma(raw) : null;
  }

  async findByLabelAndUser(label: string, userId: string): Promise<UserPaymentCardEntity | null> {
    const raw = await this.prisma.userPaymentCard.findFirst({ where: { label, userId } });
    return raw ? UserPaymentCardEntity.fromPrisma(raw) : null;
  }

  async create(data: Prisma.UserPaymentCardCreateInput): Promise<UserPaymentCardEntity> {
    const raw = await this.prisma.userPaymentCard.create({ data });
    return UserPaymentCardEntity.fromPrisma(raw);
  }

  async update(id: string, data: Prisma.UserPaymentCardUpdateInput): Promise<UserPaymentCardEntity> {
    const raw = await this.prisma.userPaymentCard.update({ where: { id }, data });
    return UserPaymentCardEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<UserPaymentCardEntity> {
    const raw = await this.prisma.userPaymentCard.delete({ where: { id } });
    return UserPaymentCardEntity.fromPrisma(raw);
  }

  async clearDefaultForUser(userId: string, exceptId?: string): Promise<void> {
    await this.prisma.userPaymentCard.updateMany({
      where: { userId, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isDefault: false },
    });
  }

  async countOrphanedSubscriptions(cardId: string): Promise<number> {
    return this.prisma.userSubscription.count({ where: { cardId } });
  }
}
