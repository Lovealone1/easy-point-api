import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SubscriptionCategoryEntity } from './domain/subscription-category.entity.js';
import { SubscriptionProviderEntity } from './domain/subscription-provider.entity.js';

@Injectable()
export class SubscriptionCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Categories

  async findAllCategories(where: Prisma.SubscriptionCategoryWhereInput): Promise<SubscriptionCategoryEntity[]> {
    const rows = await this.prisma.subscriptionCategory.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(SubscriptionCategoryEntity.fromPrisma);
  }

  async findCategoryById(id: string): Promise<SubscriptionCategoryEntity | null> {
    const raw = await this.prisma.subscriptionCategory.findUnique({ where: { id } });
    return raw ? SubscriptionCategoryEntity.fromPrisma(raw) : null;
  }

  /**
   * System categories only. `key` is no longer globally unique — users author
   * their own — so this is a findFirst scoped to `userId: null` rather than a
   * findUnique.
   */
  async findCategoryByKey(key: string): Promise<SubscriptionCategoryEntity | null> {
    const raw = await this.prisma.subscriptionCategory.findFirst({ where: { key, userId: null } });
    return raw ? SubscriptionCategoryEntity.fromPrisma(raw) : null;
  }

  async createCategory(data: Prisma.SubscriptionCategoryCreateInput): Promise<SubscriptionCategoryEntity> {
    const raw = await this.prisma.subscriptionCategory.create({ data });
    return SubscriptionCategoryEntity.fromPrisma(raw);
  }

  async updateCategory(id: string, data: Prisma.SubscriptionCategoryUpdateInput): Promise<SubscriptionCategoryEntity> {
    const raw = await this.prisma.subscriptionCategory.update({ where: { id }, data });
    return SubscriptionCategoryEntity.fromPrisma(raw);
  }

  async deleteCategory(id: string): Promise<SubscriptionCategoryEntity> {
    const raw = await this.prisma.subscriptionCategory.delete({ where: { id } });
    return SubscriptionCategoryEntity.fromPrisma(raw);
  }

  // Providers

  async findManyProvidersWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SubscriptionProviderWhereInput;
    orderBy?: Prisma.SubscriptionProviderOrderByWithRelationInput;
  }): Promise<[SubscriptionProviderEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.subscriptionProvider.findMany({ skip, take, where, orderBy, include: { category: true } }),
      this.prisma.subscriptionProvider.count({ where }),
    ]);
    return [rows.map(SubscriptionProviderEntity.fromPrisma), count];
  }

  async findProviderById(id: string): Promise<SubscriptionProviderEntity | null> {
    const raw = await this.prisma.subscriptionProvider.findUnique({
      where: { id },
      include: { category: true },
    });
    return raw ? SubscriptionProviderEntity.fromPrisma(raw) : null;
  }

  async findProviderByKey(key: string): Promise<SubscriptionProviderEntity | null> {
    const raw = await this.prisma.subscriptionProvider.findUnique({
      where: { key },
      include: { category: true },
    });
    return raw ? SubscriptionProviderEntity.fromPrisma(raw) : null;
  }

  async createProvider(data: Prisma.SubscriptionProviderCreateInput): Promise<SubscriptionProviderEntity> {
    const raw = await this.prisma.subscriptionProvider.create({ data, include: { category: true } });
    return SubscriptionProviderEntity.fromPrisma(raw);
  }

  async updateProvider(id: string, data: Prisma.SubscriptionProviderUpdateInput): Promise<SubscriptionProviderEntity> {
    const raw = await this.prisma.subscriptionProvider.update({ where: { id }, data, include: { category: true } });
    return SubscriptionProviderEntity.fromPrisma(raw);
  }

  async deleteProvider(id: string): Promise<SubscriptionProviderEntity> {
    const raw = await this.prisma.subscriptionProvider.delete({ where: { id }, include: { category: true } });
    return SubscriptionProviderEntity.fromPrisma(raw);
  }
}
