import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SubscriptionCategoryEntity } from '../subscription-catalog/domain/subscription-category.entity.js';

@Injectable()
export class UserSubscriptionCategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everything the user can pick from: the seeded system categories plus their
   * own, in one ordered list.
   */
  async findAllVisibleTo(userId: string): Promise<SubscriptionCategoryEntity[]> {
    const rows = await this.prisma.subscriptionCategory.findMany({
      where: { isActive: true, OR: [{ userId: null }, { userId }] },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(SubscriptionCategoryEntity.fromPrisma);
  }

  async findById(id: string): Promise<SubscriptionCategoryEntity | null> {
    const raw = await this.prisma.subscriptionCategory.findUnique({ where: { id } });
    return raw ? SubscriptionCategoryEntity.fromPrisma(raw) : null;
  }

  /** Key collisions are only checked within the user's own categories. */
  async findByKeyForUser(userId: string, key: string): Promise<SubscriptionCategoryEntity | null> {
    const raw = await this.prisma.subscriptionCategory.findUnique({
      where: { userId_key: { userId, key } },
    });
    return raw ? SubscriptionCategoryEntity.fromPrisma(raw) : null;
  }

  async create(data: Prisma.SubscriptionCategoryCreateInput): Promise<SubscriptionCategoryEntity> {
    const raw = await this.prisma.subscriptionCategory.create({ data });
    return SubscriptionCategoryEntity.fromPrisma(raw);
  }

  async update(
    id: string,
    data: Prisma.SubscriptionCategoryUpdateInput,
  ): Promise<SubscriptionCategoryEntity> {
    const raw = await this.prisma.subscriptionCategory.update({ where: { id }, data });
    return SubscriptionCategoryEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<SubscriptionCategoryEntity> {
    const raw = await this.prisma.subscriptionCategory.delete({ where: { id } });
    return SubscriptionCategoryEntity.fromPrisma(raw);
  }

  countSubscriptionsUsing(categoryId: string): Promise<number> {
    return this.prisma.userSubscription.count({ where: { customCategoryId: categoryId } });
  }

  /**
   * Moves every subscription off a category and deletes it in one transaction,
   * so a failure part-way cannot leave subscriptions pointing at a category
   * that is about to disappear.
   */
  async reassignAndDelete(categoryId: string, targetCategoryId: string): Promise<SubscriptionCategoryEntity> {
    const [, raw] = await this.prisma.$transaction([
      this.prisma.userSubscription.updateMany({
        where: { customCategoryId: categoryId },
        data: { customCategoryId: targetCategoryId },
      }),
      this.prisma.subscriptionCategory.delete({ where: { id: categoryId } }),
    ]);
    return SubscriptionCategoryEntity.fromPrisma(raw);
  }
}
