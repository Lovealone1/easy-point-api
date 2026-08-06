import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserSubscriptionStatus } from '@prisma/client';
import { UserSubscriptionsRepository } from './user-subscriptions.repository.js';
import { CreateUserSubscriptionDto } from './dto/create-user-subscription.dto.js';
import { UpdateUserSubscriptionDto } from './dto/update-user-subscription.dto.js';
import { FindUserSubscriptionsDto } from './dto/find-user-subscriptions.dto.js';
import { GetSubscriptionsSummaryDto } from './dto/get-subscriptions-summary.dto.js';
import { UserSubscriptionEntity } from './domain/user-subscription.entity.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { SubscriptionCatalogService } from '../subscription-catalog/subscription-catalog.service.js';
import { UserPaymentCardsService } from '../user-payment-cards/user-payment-cards.service.js';
import { addCycle, toMonthlyAmount } from './domain/billing-cycle.helper.js';

export interface SubscriptionsSummary {
  month: string;
  monthlyTotal: string;
  yearlyTotal: string;
  activeCount: number;
  pausedCount: number;
  byCard: Array<{ cardId: string | null; cardLabel: string; total: string; subscriptionCount: number }>;
  byCategory: Array<{ categoryId: string | null; categoryName: string; total: string; subscriptionCount: number }>;
  upcoming: Array<{ id: string; name: string; amount: string; currency: string; nextBillingDate: Date | null }>;
}

@Injectable()
export class UserSubscriptionsService {
  constructor(
    private readonly subscriptionsRepository: UserSubscriptionsRepository,
    private readonly catalogService: SubscriptionCatalogService,
    private readonly cardsService: UserPaymentCardsService,
  ) {}

  async findAllForUser(userId: string, query: FindUserSubscriptionsDto): Promise<PageDto<UserSubscriptionEntity>> {
    const where: Prisma.UserSubscriptionWhereInput = { userId };

    if (query.status) where.status = query.status;
    if (query.cardId) where.cardId = query.cardId;
    if (query.billingCycle) where.billingCycle = query.billingCycle;
    if (query.categoryId) {
      where.OR = [
        { provider: { categoryId: query.categoryId } },
        { customCategoryId: query.categoryId },
      ];
    }
    if (query.search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { customName: { contains: query.search, mode: 'insensitive' } },
            { planLabel: { contains: query.search, mode: 'insensitive' } },
            { provider: { name: { contains: query.search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const [items, count] = await this.subscriptionsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOneForUser(id: string, userId: string): Promise<UserSubscriptionEntity> {
    const record = await this.subscriptionsRepository.findByIdAndUser(id, userId);
    if (!record) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }
    return record;
  }

  async create(userId: string, dto: CreateUserSubscriptionDto): Promise<UserSubscriptionEntity> {
    if (!dto.providerId && !(dto.customName && dto.customCategoryId)) {
      throw new BadRequestException(
        'Debes indicar providerId, o customName junto con customCategoryId, para una suscripción personalizada',
      );
    }

    if (dto.providerId) {
      await this.catalogService.findOneProvider(dto.providerId);
    } else if (dto.customCategoryId) {
      await this.catalogService.findOneCategory(dto.customCategoryId);
    }

    if (dto.cardId) {
      await this.cardsService.findOneForUser(dto.cardId, userId);
    }

    const startedAt = new Date(dto.startedAt);
    const nextBillingDate = dto.nextBillingDate
      ? new Date(dto.nextBillingDate)
      : addCycle(startedAt, dto.billingCycle);

    return this.subscriptionsRepository.create({
      user: { connect: { id: userId } },
      provider: dto.providerId ? { connect: { id: dto.providerId } } : undefined,
      customName: dto.providerId ? null : dto.customName,
      customLogoUrl: dto.providerId ? null : (dto.customLogoUrl ?? null),
      customCategory: dto.providerId ? undefined : { connect: { id: dto.customCategoryId! } },
      card: dto.cardId ? { connect: { id: dto.cardId } } : undefined,
      planLabel: dto.planLabel ?? null,
      amount: new Prisma.Decimal(dto.amount),
      currency: dto.currency ?? 'COP',
      billingCycle: dto.billingCycle,
      startedAt,
      nextBillingDate,
      isTrial: dto.isTrial ?? false,
      trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
      notes: dto.notes ?? null,
    });
  }

  async update(id: string, userId: string, dto: UpdateUserSubscriptionDto): Promise<UserSubscriptionEntity> {
    await this.findOneForUser(id, userId);

    if (dto.providerId) {
      await this.catalogService.findOneProvider(dto.providerId);
    }
    if (dto.customCategoryId) {
      await this.catalogService.findOneCategory(dto.customCategoryId);
    }
    if (dto.cardId) {
      await this.cardsService.findOneForUser(dto.cardId, userId);
    }

    const data: Prisma.UserSubscriptionUpdateInput = {};
    if (dto.providerId !== undefined) data.provider = { connect: { id: dto.providerId } };
    if (dto.customName !== undefined) data.customName = dto.customName;
    if (dto.customLogoUrl !== undefined) data.customLogoUrl = dto.customLogoUrl;
    if (dto.customCategoryId !== undefined) data.customCategory = { connect: { id: dto.customCategoryId } };
    if (dto.cardId !== undefined) data.card = dto.cardId ? { connect: { id: dto.cardId } } : { disconnect: true };
    if (dto.planLabel !== undefined) data.planLabel = dto.planLabel;
    if (dto.amount !== undefined) data.amount = new Prisma.Decimal(dto.amount);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.billingCycle !== undefined) data.billingCycle = dto.billingCycle;
    if (dto.startedAt !== undefined) data.startedAt = new Date(dto.startedAt);
    if (dto.nextBillingDate !== undefined) data.nextBillingDate = new Date(dto.nextBillingDate);
    if (dto.isTrial !== undefined) data.isTrial = dto.isTrial;
    if (dto.trialEndsAt !== undefined) data.trialEndsAt = dto.trialEndsAt ? new Date(dto.trialEndsAt) : null;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.subscriptionsRepository.update(id, data);
  }

  async updateStatus(id: string, userId: string, status: UserSubscriptionStatus): Promise<UserSubscriptionEntity> {
    await this.findOneForUser(id, userId);

    const data: Prisma.UserSubscriptionUpdateInput = { status };
    if (status === UserSubscriptionStatus.CANCELLED) {
      data.cancelledAt = new Date();
    }

    return this.subscriptionsRepository.update(id, data);
  }

  async remove(id: string, userId: string): Promise<UserSubscriptionEntity> {
    await this.findOneForUser(id, userId);
    return this.subscriptionsRepository.delete(id);
  }

  async getSummary(userId: string, query: GetSubscriptionsSummaryDto): Promise<SubscriptionsSummary> {
    const now = new Date();
    const month = query.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const subscriptions = await this.subscriptionsRepository.findAllActiveForUser(userId);
    const activeSubs = subscriptions.filter((s) => s.status === UserSubscriptionStatus.ACTIVE);

    const zero = new Prisma.Decimal(0);
    const monthlyTotal = activeSubs.reduce(
      (acc, sub) => acc.add(toMonthlyAmount(sub.amount, sub.billingCycle)),
      zero,
    );

    const byCardMap = new Map<string, { cardId: string | null; cardLabel: string; total: Prisma.Decimal; subscriptionCount: number }>();
    const byCategoryMap = new Map<string, { categoryId: string | null; categoryName: string; total: Prisma.Decimal; subscriptionCount: number }>();

    for (const sub of activeSubs) {
      const monthly = toMonthlyAmount(sub.amount, sub.billingCycle);

      const cardKey = sub.cardId ?? 'none';
      const cardEntry = byCardMap.get(cardKey) ?? {
        cardId: sub.cardId,
        cardLabel: sub.card?.label ?? 'Sin tarjeta asignada',
        total: zero,
        subscriptionCount: 0,
      };
      cardEntry.total = cardEntry.total.add(monthly);
      cardEntry.subscriptionCount += 1;
      byCardMap.set(cardKey, cardEntry);

      const category = sub.displayCategory;
      const categoryKey = category?.id ?? 'none';
      const categoryEntry = byCategoryMap.get(categoryKey) ?? {
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? 'Sin categoría',
        total: zero,
        subscriptionCount: 0,
      };
      categoryEntry.total = categoryEntry.total.add(monthly);
      categoryEntry.subscriptionCount += 1;
      byCategoryMap.set(categoryKey, categoryEntry);
    }

    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcoming = activeSubs
      .filter((s) => s.nextBillingDate && s.nextBillingDate >= now && s.nextBillingDate <= in30Days)
      .sort((a, b) => a.nextBillingDate!.getTime() - b.nextBillingDate!.getTime())
      .map((s) => ({
        id: s.id,
        name: s.displayName,
        amount: s.amount.toFixed(2),
        currency: s.currency,
        nextBillingDate: s.nextBillingDate,
      }));

    return {
      month,
      monthlyTotal: monthlyTotal.toFixed(2),
      yearlyTotal: monthlyTotal.mul(12).toFixed(2),
      activeCount: activeSubs.length,
      pausedCount: subscriptions.filter((s) => s.status === UserSubscriptionStatus.PAUSED).length,
      byCard: [...byCardMap.values()].map((c) => ({ ...c, total: c.total.toFixed(2) })),
      byCategory: [...byCategoryMap.values()].map((c) => ({ ...c, total: c.total.toFixed(2) })),
      upcoming,
    };
  }
}
