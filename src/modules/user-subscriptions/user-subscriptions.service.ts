import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserSubscriptionStatus } from '@prisma/client';
import { UserSubscriptionsRepository } from './user-subscriptions.repository.js';
import { CreateUserSubscriptionDto } from './dto/create-user-subscription.dto.js';
import { UpdateUserSubscriptionDto } from './dto/update-user-subscription.dto.js';
import { FindUserSubscriptionsDto } from './dto/find-user-subscriptions.dto.js';
import { GetSubscriptionsSummaryDto } from './dto/get-subscriptions-summary.dto.js';
import { LogUsageCheckinDto } from './dto/log-usage-checkin.dto.js';
import { FindUsageCheckinsDto } from './dto/find-usage-checkins.dto.js';
import { GetCashFlowCalendarDto } from './dto/get-cash-flow-calendar.dto.js';
import { UserSubscriptionEntity } from './domain/user-subscription.entity.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { SubscriptionCatalogService } from '../subscription-catalog/subscription-catalog.service.js';
import { UserPaymentCardsService } from '../user-payment-cards/user-payment-cards.service.js';
import { addCycle, projectOccurrences, toMonthlyAmount } from './domain/billing-cycle.helper.js';
import { computeUsageStats, UsageStats } from './domain/usage-stats.helper.js';
import { resolveStatementWindow } from '../user-payment-cards/domain/billing-window.helper.js';

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

export interface LastPriceChange {
  previousAmount: string;
  newAmount: string;
  currency: string;
  changePercent: number;
  changedAt: Date;
}

export interface PriceHistoryEntry {
  id: string;
  amount: string;
  currency: string;
  effectiveFrom: Date;
  createdAt: Date;
}

export interface UsageStatsResponse {
  usageRate14d: number | null;
  checkInCount14d: number;
  usedCount30d: number;
  costPerUse30d: string | null;
  lastUsedAt: Date | null;
  isZombieCandidate: boolean;
}

export interface ZombieCandidate extends UsageStatsResponse {
  id: string;
  name: string;
  monthlyEquivalentAmount: string;
  currency: string;
}

export interface CashFlowCalendarDay {
  date: string;
  total: string;
  charges: Array<{ subscriptionId: string; name: string; amount: string; currency: string; cardId: string | null; cardLabel: string }>;
}

export interface CashFlowCalendarCard {
  cardId: string;
  cardLabel: string;
  statementDay: number | null;
  paymentDueDay: number | null;
  needsSetup: boolean;
  currentCycle: { cycleStart: string; cycleEnd: string } | null;
  cycleTotal: string;
}

export interface CashFlowCalendar {
  month: string;
  days: CashFlowCalendarDay[];
  byCard: CashFlowCalendarCard[];
}

const PRICE_CHANGE_LOOKBACK_DAYS = 90;

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

  /** Same as findOneForUser but also resolves the lastPriceChange badge — used by the detail route. */
  async getDetailForUser(id: string, userId: string): Promise<UserSubscriptionEntity & { lastPriceChange: LastPriceChange | null }> {
    const record = await this.findOneForUser(id, userId);
    const lastPriceChange = await this.computeLastPriceChange(id);
    return Object.assign(record, { lastPriceChange });
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
    const amount = new Prisma.Decimal(dto.amount);
    const currency = dto.currency ?? 'COP';

    return this.subscriptionsRepository.create(
      {
        user: { connect: { id: userId } },
        provider: dto.providerId ? { connect: { id: dto.providerId } } : undefined,
        customName: dto.providerId ? null : dto.customName,
        customLogoUrl: dto.providerId ? null : (dto.customLogoUrl ?? null),
        customCategory: dto.providerId ? undefined : { connect: { id: dto.customCategoryId! } },
        card: dto.cardId ? { connect: { id: dto.cardId } } : undefined,
        planLabel: dto.planLabel ?? null,
        amount,
        currency,
        billingCycle: dto.billingCycle,
        startedAt,
        nextBillingDate,
        isTrial: dto.isTrial ?? false,
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
        notes: dto.notes ?? null,
      },
      { amount, currency, effectiveFrom: startedAt },
    );
  }

  async update(id: string, userId: string, dto: UpdateUserSubscriptionDto): Promise<UserSubscriptionEntity> {
    const current = await this.findOneForUser(id, userId);

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

    // Price history rule: only a change to amount and/or currency creates a snapshot.
    const nextAmount = dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : current.amount;
    const nextCurrency = dto.currency ?? current.currency;
    const priceChanged = !nextAmount.equals(current.amount) || nextCurrency !== current.currency;

    return this.subscriptionsRepository.update(
      id,
      data,
      priceChanged ? { amount: nextAmount, currency: nextCurrency, effectiveFrom: new Date() } : undefined,
    );
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

  // --- Price history ---------------------------------------------------

  async getPriceHistory(id: string, userId: string): Promise<PriceHistoryEntry[]> {
    await this.findOneForUser(id, userId);
    const rows = await this.subscriptionsRepository.findPriceHistory(id);
    return rows.map((r) => ({
      id: r.id,
      amount: r.amount.toFixed(2),
      currency: r.currency,
      effectiveFrom: r.effectiveFrom,
      createdAt: r.createdAt,
    }));
  }

  private async computeLastPriceChange(id: string): Promise<LastPriceChange | null> {
    const [latest, previous] = await this.subscriptionsRepository.findLatestTwoPriceSnapshots(id);
    if (!latest || !previous) return null;

    const withinLookback = Date.now() - latest.createdAt.getTime() <= PRICE_CHANGE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    if (!withinLookback) return null;
    if (latest.amount.equals(previous.amount) && latest.currency === previous.currency) return null;

    const changePercent = previous.amount.isZero()
      ? 0
      : Number(latest.amount.sub(previous.amount).div(previous.amount).mul(100).toFixed(1));

    return {
      previousAmount: previous.amount.toFixed(2),
      newAmount: latest.amount.toFixed(2),
      currency: latest.currency,
      changePercent,
      changedAt: latest.createdAt,
    };
  }

  // --- Usage check-ins & zombie detection -------------------------------

  async logUsageCheckin(id: string, userId: string, dto: LogUsageCheckinDto): Promise<{ id: string; date: Date; used: boolean }> {
    await this.findOneForUser(id, userId);
    const date = dto.date ? new Date(dto.date) : startOfDay(new Date());
    return this.subscriptionsRepository.upsertUsageCheckin(id, startOfDay(date), dto.used);
  }

  async getUsageCheckins(id: string, userId: string, query: FindUsageCheckinsDto): Promise<Array<{ date: Date; used: boolean }>> {
    await this.findOneForUser(id, userId);
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.subscriptionsRepository.findUsageCheckins(id, startOfDay(from), startOfDay(to));
  }

  async getUsageStats(id: string, userId: string): Promise<UsageStatsResponse> {
    const subscription = await this.findOneForUser(id, userId);
    const logs = await this.subscriptionsRepository.findAllUsageLogs(id);
    const monthlyEquivalent = toMonthlyAmount(subscription.amount, subscription.billingCycle);
    const stats = computeUsageStats(logs, monthlyEquivalent, subscription.startedAt);
    return toUsageStatsResponse(stats);
  }

  async getZombieCandidates(userId: string): Promise<ZombieCandidate[]> {
    const subscriptions = await this.subscriptionsRepository.findAllActiveWithUsageLogsForUser(userId);

    const candidates: ZombieCandidate[] = [];
    for (const sub of subscriptions) {
      const monthlyEquivalent = toMonthlyAmount(sub.amount, sub.billingCycle);
      const stats = computeUsageStats(sub.usageLogs, monthlyEquivalent, sub.startedAt);
      if (!stats.isZombieCandidate) continue;

      candidates.push({
        id: sub.id,
        name: sub.displayName,
        monthlyEquivalentAmount: monthlyEquivalent.toFixed(2),
        currency: sub.currency,
        ...toUsageStatsResponse(stats),
      });
    }

    return candidates.sort((a, b) => Number(b.monthlyEquivalentAmount) - Number(a.monthlyEquivalentAmount));
  }

  // --- Cash-flow calendar -------------------------------------------------

  async getCashFlowCalendar(userId: string, query: GetCashFlowCalendarDto): Promise<CashFlowCalendar> {
    const now = new Date();
    const [year, monthIndex] = (query.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
      .split('-')
      .map(Number);
    const month = `${year}-${String(monthIndex).padStart(2, '0')}`;

    const rangeStart = new Date(year, monthIndex - 1, 1);
    const rangeEnd = new Date(year, monthIndex, 0, 23, 59, 59, 999);

    const [subscriptions, cards] = await Promise.all([
      this.subscriptionsRepository.findAllActiveForUser(userId),
      this.cardsService.findAllForUser(userId),
    ]);
    const activeSubs = subscriptions.filter((s) => s.status === UserSubscriptionStatus.ACTIVE);

    const dayMap = new Map<string, CashFlowCalendarDay>();
    const cardCycleTotals = new Map<string, Prisma.Decimal>();

    for (const sub of activeSubs) {
      if (!sub.nextBillingDate) continue;

      const occurrences = projectOccurrences(sub.nextBillingDate, sub.billingCycle, rangeStart, rangeEnd);
      for (const occurrence of occurrences) {
        const key = toDateKey(occurrence);
        const day = dayMap.get(key) ?? { date: key, total: '0.00', charges: [] };
        day.charges.push({
          subscriptionId: sub.id,
          name: sub.displayName,
          amount: sub.amount.toFixed(2),
          currency: sub.currency,
          cardId: sub.cardId,
          cardLabel: sub.card?.label ?? 'Sin tarjeta asignada',
        });
        day.total = new Prisma.Decimal(day.total).add(sub.amount).toFixed(2);
        dayMap.set(key, day);

        if (sub.cardId) {
          const card = cards.find((c) => c.id === sub.cardId);
          if (card?.statementDay) {
            const window = resolveStatementWindow(card.statementDay, occurrence);
            if (occurrence >= window.cycleStart && occurrence < window.cycleEnd) {
              const current = cardCycleTotals.get(card.id) ?? new Prisma.Decimal(0);
              cardCycleTotals.set(card.id, current.add(sub.amount));
            }
          }
        }
      }
    }

    const byCard: CashFlowCalendarCard[] = cards.map((card) => {
      const currentCycle = card.statementDay ? resolveStatementWindow(card.statementDay, now) : null;
      return {
        cardId: card.id,
        cardLabel: card.label,
        statementDay: card.statementDay,
        paymentDueDay: card.paymentDueDay,
        needsSetup: !card.statementDay,
        currentCycle: currentCycle
          ? { cycleStart: toDateKey(currentCycle.cycleStart), cycleEnd: toDateKey(currentCycle.cycleEnd) }
          : null,
        cycleTotal: (cardCycleTotals.get(card.id) ?? new Prisma.Decimal(0)).toFixed(2),
      };
    });

    const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    return { month, days, byCard };
  }
}

function toUsageStatsResponse(stats: UsageStats): UsageStatsResponse {
  return {
    usageRate14d: stats.usageRate14d,
    checkInCount14d: stats.checkInCount14d,
    usedCount30d: stats.usedCount30d,
    costPerUse30d: stats.costPerUse30d ? stats.costPerUse30d.toFixed(2) : null,
    lastUsedAt: stats.lastUsedAt,
    isZombieCandidate: stats.isZombieCandidate,
  };
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
