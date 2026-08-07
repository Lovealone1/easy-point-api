import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, RecurrenceUnit, UserSubscriptionStatus } from '@prisma/client';
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
import { addRecurrence, projectOccurrences, toMonthlyAmount, type Recurrence } from './domain/recurrence.helper.js';
import { computeUsageStats, UsageStats } from './domain/usage-stats.helper.js';
import { resolveStatementWindow } from '../user-payment-cards/domain/billing-window.helper.js';
import { CurrenciesService } from '../currencies/currencies.service.js';
import { UserSubscriptionCategoriesService } from '../user-subscription-categories/user-subscription-categories.service.js';
import { UserPreferencesService } from '../user-preferences/user-preferences.service.js';
import { FxRateService } from '../exchange-rates/fx-rate.service.js';
import { convertAmount } from '../exchange-rates/domain/fx-conversion.helper.js';
import type { FxRateTable } from '../exchange-rates/providers/fx-provider.interface.js';
import { StorageService } from '../../infraestructure/storage/storage.service.js';

/**
 * Provenance of the converted figures in a response. `unavailable` means every
 * `*Converted` field is null and the UI should present raw per-currency totals
 * only, rather than a total it cannot vouch for.
 */
export interface FxMetadata {
  asOf: Date | null;
  stale: boolean;
  unavailable: boolean;
  attribution: string;
}

export interface SubscriptionsSummary {
  month: string;
  /** Currency every `*Converted` figure is expressed in. */
  preferredCurrency: string;
  monthlyTotal: string;
  yearlyTotal: string;
  /** null when no rates were available. */
  monthlyTotalConverted: string | null;
  yearlyTotalConverted: string | null;
  /** One-time charges billing this month; excluded from the monthly run rate. */
  oneTimeTotalThisMonth: string | null;
  activeCount: number;
  pausedCount: number;
  /** Raw per-currency breakdown — the source of truth, never replaced by conversion. */
  byCurrency: Array<{ currency: string; total: string; convertedTotal: string | null; subscriptionCount: number }>;
  byCard: Array<{ cardId: string | null; cardLabel: string; total: string; currency: string; subscriptionCount: number }>;
  byCategory: Array<{ categoryId: string | null; categoryName: string; total: string; currency: string; subscriptionCount: number }>;
  upcoming: Array<{
    id: string;
    name: string;
    amount: string;
    currency: string;
    convertedAmount: string | null;
    nextBillingDate: Date | null;
  }>;
  rates: FxMetadata;
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
  /** Expressed in the user's preferred currency; null when rates were unavailable. */
  total: string | null;
  charges: Array<{
    subscriptionId: string;
    name: string;
    amount: string;
    currency: string;
    convertedAmount: string | null;
    cardId: string | null;
    cardLabel: string;
  }>;
}

export interface CashFlowCalendarCard {
  cardId: string;
  cardLabel: string;
  statementDay: number | null;
  paymentDueDay: number | null;
  needsSetup: boolean;
  currentCycle: { cycleStart: string; cycleEnd: string } | null;
  cycleTotal: string | null;
}

export interface CashFlowCalendar {
  month: string;
  preferredCurrency: string;
  days: CashFlowCalendarDay[];
  byCard: CashFlowCalendarCard[];
  rates: FxMetadata;
}

const PRICE_CHANGE_LOOKBACK_DAYS = 90;

/** Logos users upload; catalog-backed subscriptions never reach this path. */
const ALLOWED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

@Injectable()
export class UserSubscriptionsService {
  private readonly logger = new Logger(UserSubscriptionsService.name);

  constructor(
    private readonly subscriptionsRepository: UserSubscriptionsRepository,
    private readonly catalogService: SubscriptionCatalogService,
    private readonly cardsService: UserPaymentCardsService,
    private readonly categoriesService: UserSubscriptionCategoriesService,
    private readonly currenciesService: CurrenciesService,
    private readonly preferencesService: UserPreferencesService,
    private readonly fxRateService: FxRateService,
    private readonly storageService: StorageService,
  ) {}

  async findAllForUser(userId: string, query: FindUserSubscriptionsDto): Promise<PageDto<UserSubscriptionEntity>> {
    const where: Prisma.UserSubscriptionWhereInput = { userId };

    if (query.status) where.status = query.status;
    if (query.cardId) where.cardId = query.cardId;
    if (query.recurrenceUnit) where.recurrenceUnit = query.recurrenceUnit;
    if (query.isRecurring !== undefined) where.isRecurring = query.isRecurring;
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
    return new PageDto(await this.resolveLogos(items), pageMetaDto);
  }

  async findOneForUser(id: string, userId: string): Promise<UserSubscriptionEntity> {
    const record = await this.subscriptionsRepository.findByIdAndUser(id, userId);
    if (!record) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }
    return this.resolveLogo(record);
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

    this.assertCustomFieldsAllowed(dto);

    if (dto.providerId) {
      await this.catalogService.findOneProvider(dto.providerId);
    } else if (dto.customCategoryId) {
      // Ownership-aware: a system category or one of the user's own, never
      // someone else's.
      await this.categoriesService.assertUsableBy(dto.customCategoryId, userId);
    }

    if (dto.cardId) {
      await this.cardsService.findOneForUser(dto.cardId, userId);
    }

    const currency = (await this.currenciesService.assertExists(dto.currency ?? 'COP')).code;
    const recurrence = normalizeRecurrence(dto.recurrenceUnit, dto.recurrenceInterval, dto.isRecurring);

    const startedAt = new Date(dto.startedAt);
    const nextBillingDate = dto.nextBillingDate
      ? new Date(dto.nextBillingDate)
      : this.deriveNextBillingDate(startedAt, recurrence);
    const amount = new Prisma.Decimal(dto.amount);

    const created = await this.subscriptionsRepository.create(
      {
        user: { connect: { id: userId } },
        provider: dto.providerId ? { connect: { id: dto.providerId } } : undefined,
        customName: dto.providerId ? null : dto.customName,
        customLogoUrl: dto.providerId ? null : (dto.customLogoUrl ?? null),
        customWebsiteUrl: dto.providerId ? null : (dto.customWebsiteUrl ?? null),
        customCategory: dto.providerId ? undefined : { connect: { id: dto.customCategoryId! } },
        card: dto.cardId ? { connect: { id: dto.cardId } } : undefined,
        // Deliberately not copied from the card: leaving it null lets a change
        // to the card's statement day propagate to every subscription on it.
        billingCutoffDay: dto.billingCutoffDay ?? null,
        planLabel: dto.planLabel ?? null,
        amount,
        currency,
        recurrenceUnit: recurrence.unit,
        recurrenceInterval: recurrence.interval,
        isRecurring: recurrence.isRecurring,
        startedAt,
        nextBillingDate,
        isTrial: dto.isTrial ?? false,
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
        notes: dto.notes ?? null,
      },
      { amount, currency, effectiveFrom: startedAt },
    );

    return this.resolveLogo(created);
  }

  /**
   * Catalog-backed subscriptions take their identity from the provider. The
   * frontend locks those fields, so a value arriving here is a bug worth
   * surfacing rather than silently discarding.
   */
  private assertCustomFieldsAllowed(dto: CreateUserSubscriptionDto | UpdateUserSubscriptionDto): void {
    if (!dto.providerId) return;

    const conflicts: string[] = [];
    if (dto.customCategoryId) conflicts.push('customCategoryId');
    if (dto.customName) conflicts.push('customName');
    if (dto.customLogoUrl) conflicts.push('customLogoUrl');
    if (dto.customWebsiteUrl) conflicts.push('customWebsiteUrl');

    if (conflicts.length > 0) {
      throw new BadRequestException(
        `Los campos ${conflicts.join(', ')} se toman del proveedor del catálogo y no pueden enviarse junto con providerId.`,
      );
    }
  }

  /** A one-time charge is billed on its start date and never again. */
  private deriveNextBillingDate(startedAt: Date, recurrence: Recurrence): Date {
    return recurrence.isRecurring ? addRecurrence(startedAt, recurrence) : startedAt;
  }

  async update(id: string, userId: string, dto: UpdateUserSubscriptionDto): Promise<UserSubscriptionEntity> {
    const current = await this.findOneForUser(id, userId);

    this.assertCustomFieldsAllowed(dto);

    if (dto.providerId) {
      await this.catalogService.findOneProvider(dto.providerId);
    }
    if (dto.customCategoryId) {
      await this.categoriesService.assertUsableBy(dto.customCategoryId, userId);
    }
    if (dto.cardId) {
      await this.cardsService.findOneForUser(dto.cardId, userId);
    }

    const data: Prisma.UserSubscriptionUpdateInput = {};
    if (dto.providerId !== undefined) data.provider = { connect: { id: dto.providerId } };
    if (dto.customName !== undefined) data.customName = dto.customName;
    if (dto.customLogoUrl !== undefined) data.customLogoUrl = dto.customLogoUrl;
    if (dto.customWebsiteUrl !== undefined) data.customWebsiteUrl = dto.customWebsiteUrl;
    if (dto.customCategoryId !== undefined) data.customCategory = { connect: { id: dto.customCategoryId } };
    if (dto.cardId !== undefined) data.card = dto.cardId ? { connect: { id: dto.cardId } } : { disconnect: true };
    if (dto.billingCutoffDay !== undefined) data.billingCutoffDay = dto.billingCutoffDay;
    if (dto.planLabel !== undefined) data.planLabel = dto.planLabel;
    if (dto.amount !== undefined) data.amount = new Prisma.Decimal(dto.amount);
    if (dto.startedAt !== undefined) data.startedAt = new Date(dto.startedAt);
    if (dto.isTrial !== undefined) data.isTrial = dto.isTrial;
    if (dto.trialEndsAt !== undefined) data.trialEndsAt = dto.trialEndsAt ? new Date(dto.trialEndsAt) : null;
    if (dto.notes !== undefined) data.notes = dto.notes;

    let nextCurrency = current.currency;
    if (dto.currency !== undefined) {
      nextCurrency = (await this.currenciesService.assertExists(dto.currency)).code;
      data.currency = nextCurrency;
    }

    const recurrenceChanged =
      dto.recurrenceUnit !== undefined ||
      dto.recurrenceInterval !== undefined ||
      dto.isRecurring !== undefined;

    const recurrence = normalizeRecurrence(
      dto.recurrenceUnit ?? current.recurrenceUnit,
      dto.recurrenceInterval ?? current.recurrenceInterval,
      dto.isRecurring ?? current.isRecurring,
    );

    if (recurrenceChanged) {
      data.recurrenceUnit = recurrence.unit;
      data.recurrenceInterval = recurrence.interval;
      data.isRecurring = recurrence.isRecurring;
    }

    if (dto.nextBillingDate !== undefined) {
      data.nextBillingDate = new Date(dto.nextBillingDate);
    } else if (recurrenceChanged || dto.startedAt !== undefined) {
      // Changing the schedule without recomputing the next charge would leave a
      // date derived from the old cadence.
      const startedAt = dto.startedAt !== undefined ? new Date(dto.startedAt) : current.startedAt;
      data.nextBillingDate = this.deriveNextBillingDate(startedAt, recurrence);
    }

    // Price history rule: only a change to amount and/or currency creates a snapshot.
    const nextAmount = dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : current.amount;
    const priceChanged = !nextAmount.equals(current.amount) || nextCurrency !== current.currency;

    const updated = await this.subscriptionsRepository.update(
      id,
      data,
      priceChanged ? { amount: nextAmount, currency: nextCurrency, effectiveFrom: new Date() } : undefined,
    );

    return this.resolveLogo(updated);
  }

  async updateStatus(id: string, userId: string, status: UserSubscriptionStatus): Promise<UserSubscriptionEntity> {
    await this.findOneForUser(id, userId);

    const data: Prisma.UserSubscriptionUpdateInput = { status };
    if (status === UserSubscriptionStatus.CANCELLED) {
      data.cancelledAt = new Date();
    }

    return this.resolveLogo(await this.subscriptionsRepository.update(id, data));
  }

  async remove(id: string, userId: string): Promise<UserSubscriptionEntity> {
    const current = await this.findOneForUser(id, userId);

    // Best-effort cleanup of the uploaded logo; a failure here must not block
    // the deletion the user asked for.
    if (isStorageKey(current.customLogoUrl)) {
      await this.storageService.deleteFile(current.customLogoUrl!).catch((error: unknown) => {
        this.logger.warn(`Could not delete the logo for subscription ${id}: ${describeError(error)}`);
      });
    }

    return this.subscriptionsRepository.delete(id);
  }

  // --- Custom logo ------------------------------------------------------

  async uploadLogo(id: string, userId: string, file: Express.Multer.File): Promise<UserSubscriptionEntity> {
    // Read through the repository rather than findOneForUser: the latter signs
    // customLogoUrl, and we need the raw key to delete the previous object.
    const subscription = await this.subscriptionsRepository.findByIdAndUser(id, userId);
    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    if (subscription.providerId) {
      throw new BadRequestException(
        'Las suscripciones del catálogo usan el logo del proveedor y no admiten uno personalizado.',
      );
    }

    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Formato no permitido. Usa uno de: ${ALLOWED_LOGO_MIME_TYPES.join(', ')}`,
      );
    }

    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException('El logo no puede superar los 2 MB');
    }

    if (isStorageKey(subscription.customLogoUrl)) {
      await this.storageService.deleteFile(subscription.customLogoUrl!).catch((error: unknown) => {
        this.logger.warn(`Could not delete the previous logo for subscription ${id}: ${describeError(error)}`);
      });
    }

    const extension = file.mimetype.split('/')[1]?.replace('+xml', '') ?? 'png';
    // Partitioned by user so an account-deletion job can clear a whole prefix.
    const fileName = `user-subscription-logos/${userId}/${id}_${Date.now()}.${extension}`;

    await this.storageService.uploadFile(file.buffer, fileName, file.mimetype);

    return this.resolveLogo(await this.subscriptionsRepository.update(id, { customLogoUrl: fileName }));
  }

  async deleteLogo(id: string, userId: string): Promise<UserSubscriptionEntity> {
    const subscription = await this.subscriptionsRepository.findByIdAndUser(id, userId);
    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    if (isStorageKey(subscription.customLogoUrl)) {
      await this.storageService.deleteFile(subscription.customLogoUrl!).catch((error: unknown) => {
        this.logger.warn(`Could not delete the logo for subscription ${id}: ${describeError(error)}`);
      });
    }

    return this.resolveLogo(await this.subscriptionsRepository.update(id, { customLogoUrl: null }));
  }

  /**
   * Turns a stored S3 key into a URL the browser can actually render. Seeded
   * catalog logos are already absolute URLs and pass through untouched.
   */
  private async resolveLogo(subscription: UserSubscriptionEntity): Promise<UserSubscriptionEntity> {
    if (!isStorageKey(subscription.customLogoUrl)) return subscription;

    try {
      subscription.customLogoUrl = await this.storageService.getPresignedUrl(subscription.customLogoUrl!);
    } catch (error: unknown) {
      this.logger.warn(`Could not sign the logo for subscription ${subscription.id}: ${describeError(error)}`);
    }

    return subscription;
  }

  private resolveLogos(subscriptions: UserSubscriptionEntity[]): Promise<UserSubscriptionEntity[]> {
    return Promise.all(subscriptions.map((s) => this.resolveLogo(s)));
  }

  async getSummary(userId: string, query: GetSubscriptionsSummaryDto): Promise<SubscriptionsSummary> {
    const now = new Date();
    const month = query.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [subscriptions, preferredCurrency] = await Promise.all([
      this.subscriptionsRepository.findAllActiveForUser(userId),
      this.preferencesService.getPreferredCurrency(userId),
    ]);
    const activeSubs = subscriptions.filter((s) => s.status === UserSubscriptionStatus.ACTIVE);

    // One rate lookup per request, reused for every amount below.
    const fx = await this.loadFxContext(preferredCurrency);

    const zero = new Prisma.Decimal(0);

    // Raw per-currency run rate — the source of truth, kept regardless of
    // whether conversion succeeds.
    const byCurrencyMap = new Map<string, { total: Prisma.Decimal; subscriptionCount: number }>();
    const byCardMap = new Map<string, { cardId: string | null; cardLabel: string; total: Prisma.Decimal; subscriptionCount: number }>();
    const byCategoryMap = new Map<string, { categoryId: string | null; categoryName: string; total: Prisma.Decimal; subscriptionCount: number }>();

    let monthlyTotal = zero;
    let monthlyTotalConverted: Prisma.Decimal | null = fx.available ? zero : null;
    let oneTimeTotal: Prisma.Decimal | null = fx.available ? zero : null;

    const monthRange = parseMonthRange(month);

    for (const sub of activeSubs) {
      const monthly = toMonthlyAmount(sub.amount, sub.recurrence);
      const monthlyConverted = fx.convert(monthly, sub.currency);

      monthlyTotal = monthlyTotal.add(monthly);
      if (monthlyTotalConverted && monthlyConverted) {
        monthlyTotalConverted = monthlyTotalConverted.add(monthlyConverted);
      }

      // One-time charges have no run rate, so they are reported separately
      // rather than being silently invisible.
      if (!sub.isRecurring && oneTimeTotal && sub.nextBillingDate) {
        const billsThisMonth =
          sub.nextBillingDate >= monthRange.start && sub.nextBillingDate <= monthRange.end;
        const converted = billsThisMonth ? fx.convert(sub.amount, sub.currency) : null;
        if (converted) oneTimeTotal = oneTimeTotal.add(converted);
      }

      const currencyEntry = byCurrencyMap.get(sub.currency) ?? { total: zero, subscriptionCount: 0 };
      currencyEntry.total = currencyEntry.total.add(monthly);
      currencyEntry.subscriptionCount += 1;
      byCurrencyMap.set(sub.currency, currencyEntry);

      // Card and category buckets are expressed in the preferred currency;
      // summing raw amounts across currencies here was always wrong.
      const bucketAmount = monthlyConverted ?? monthly;

      const cardKey = sub.cardId ?? 'none';
      const cardEntry = byCardMap.get(cardKey) ?? {
        cardId: sub.cardId,
        cardLabel: sub.card?.label ?? 'Sin tarjeta asignada',
        total: zero,
        subscriptionCount: 0,
      };
      cardEntry.total = cardEntry.total.add(bucketAmount);
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
      categoryEntry.total = categoryEntry.total.add(bucketAmount);
      categoryEntry.subscriptionCount += 1;
      byCategoryMap.set(categoryKey, categoryEntry);
    }

    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcoming = await Promise.all(
      activeSubs
        .filter((s) => s.nextBillingDate && s.nextBillingDate >= now && s.nextBillingDate <= in30Days)
        .sort((a, b) => a.nextBillingDate!.getTime() - b.nextBillingDate!.getTime())
        .map(async (s) => ({
          id: s.id,
          name: s.displayName,
          amount: s.amount.toFixed(2),
          currency: s.currency,
          convertedAmount: await fx.format(fx.convert(s.amount, s.currency)),
          nextBillingDate: s.nextBillingDate,
        })),
    );

    const byCurrency = await Promise.all(
      [...byCurrencyMap.entries()].map(async ([currency, entry]) => ({
        currency,
        total: entry.total.toFixed(2),
        convertedTotal: await fx.format(fx.convert(entry.total, currency)),
        subscriptionCount: entry.subscriptionCount,
      })),
    );

    return {
      month,
      preferredCurrency,
      monthlyTotal: monthlyTotal.toFixed(2),
      yearlyTotal: monthlyTotal.mul(12).toFixed(2),
      monthlyTotalConverted: await fx.format(monthlyTotalConverted),
      yearlyTotalConverted: await fx.format(monthlyTotalConverted?.mul(12) ?? null),
      oneTimeTotalThisMonth: await fx.format(oneTimeTotal),
      activeCount: activeSubs.length,
      pausedCount: subscriptions.filter((s) => s.status === UserSubscriptionStatus.PAUSED).length,
      byCurrency,
      byCard: [...byCardMap.values()].map((c) => ({
        ...c,
        total: c.total.toFixed(2),
        currency: preferredCurrency,
      })),
      byCategory: [...byCategoryMap.values()].map((c) => ({
        ...c,
        total: c.total.toFixed(2),
        currency: preferredCurrency,
      })),
      upcoming,
      rates: fx.metadata,
    };
  }

  /**
   * Loads the rate table once and returns closures for converting into the
   * user's preferred currency. Conversion failures surface as null values and
   * an `unavailable` flag — never as an exception, because a summary that 500s
   * because a free FX endpoint blinked is worse than one without conversion.
   */
  private async loadFxContext(preferredCurrency: string) {
    const { table, stale, unavailable } = await this.fxRateService.getPivotTable();
    const decimalDigits = await this.currenciesService.getDecimalDigits(preferredCurrency);
    const available = !unavailable && table !== null;

    const convert = (amount: Prisma.Decimal, from: string): Prisma.Decimal | null => {
      if (!table) return null;
      if (from === preferredCurrency) return amount;
      return convertAmount(amount, table, from, preferredCurrency, decimalDigits)?.amount ?? null;
    };

    return {
      available,
      table: table as FxRateTable | null,
      convert,
      format: async (amount: Prisma.Decimal | null): Promise<string | null> =>
        amount ? amount.toFixed(decimalDigits) : null,
      metadata: {
        asOf: table?.ratesAsOf ?? null,
        stale,
        unavailable: !available,
        attribution: this.fxRateService.attribution,
      } satisfies FxMetadata,
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
    const monthlyEquivalent = toMonthlyAmount(subscription.amount, subscription.recurrence);
    const stats = computeUsageStats(logs, monthlyEquivalent, subscription.startedAt);
    return toUsageStatsResponse(stats);
  }

  async getZombieCandidates(userId: string): Promise<ZombieCandidate[]> {
    const subscriptions = await this.subscriptionsRepository.findAllActiveWithUsageLogsForUser(userId);

    const candidates: ZombieCandidate[] = [];
    for (const sub of subscriptions) {
      const monthlyEquivalent = toMonthlyAmount(sub.amount, sub.recurrence);
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

    // UTC to match the recurrence helper: billing dates are calendar dates, and
    // mixing local-time ranges with UTC arithmetic shifts charges by a day.
    const rangeStart = new Date(Date.UTC(year, monthIndex - 1, 1));
    const rangeEnd = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));

    const [subscriptions, cards, preferredCurrency] = await Promise.all([
      this.subscriptionsRepository.findAllActiveForUser(userId),
      this.cardsService.findAllForUser(userId),
      this.preferencesService.getPreferredCurrency(userId),
    ]);
    const activeSubs = subscriptions.filter((s) => s.status === UserSubscriptionStatus.ACTIVE);

    const fx = await this.loadFxContext(preferredCurrency);
    const zero = new Prisma.Decimal(0);

    const dayMap = new Map<string, CashFlowCalendarDay>();
    const dayTotals = new Map<string, Prisma.Decimal>();
    const cardCycleTotals = new Map<string, Prisma.Decimal>();

    for (const sub of activeSubs) {
      if (!sub.nextBillingDate) continue;

      const converted = fx.convert(sub.amount, sub.currency);
      const occurrences = projectOccurrences(sub.nextBillingDate, sub.recurrence, rangeStart, rangeEnd);

      for (const occurrence of occurrences) {
        const key = toDateKey(occurrence);
        const day = dayMap.get(key) ?? { date: key, total: null, charges: [] };
        day.charges.push({
          subscriptionId: sub.id,
          name: sub.displayName,
          amount: sub.amount.toFixed(2),
          currency: sub.currency,
          convertedAmount: await fx.format(converted),
          cardId: sub.cardId,
          cardLabel: sub.card?.label ?? 'Sin tarjeta asignada',
        });
        dayMap.set(key, day);

        if (converted) {
          dayTotals.set(key, (dayTotals.get(key) ?? zero).add(converted));

          if (sub.cardId) {
            const card = cards.find((c) => c.id === sub.cardId);
            // The subscription's own cutoff day wins over the card's, so a
            // per-subscription override lands in the right statement cycle.
            const statementDay = sub.billingCutoffDay ?? card?.statementDay ?? null;
            if (card && statementDay) {
              const window = resolveStatementWindow(statementDay, occurrence);
              if (occurrence >= window.cycleStart && occurrence < window.cycleEnd) {
                cardCycleTotals.set(card.id, (cardCycleTotals.get(card.id) ?? zero).add(converted));
              }
            }
          }
        }
      }
    }

    for (const [key, total] of dayTotals) {
      const day = dayMap.get(key);
      if (day) day.total = await fx.format(total);
    }

    const byCard: CashFlowCalendarCard[] = await Promise.all(
      cards.map(async (card) => {
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
          cycleTotal: await fx.format(cardCycleTotals.get(card.id) ?? (fx.available ? zero : null)),
        };
      }),
    );

    const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    return { month, preferredCurrency, days, byCard, rates: fx.metadata };
  }
}

/**
 * Applies the invariants a recurrence must satisfy before it is stored. A
 * one-time charge has no meaningful unit or interval, so they are normalized
 * rather than left to whatever the client happened to send.
 */
function normalizeRecurrence(
  unit: RecurrenceUnit,
  interval: number | undefined,
  isRecurring: boolean | undefined,
): Recurrence {
  const recurring = isRecurring ?? true;

  if (!recurring) {
    return { unit: RecurrenceUnit.MONTH, interval: 1, isRecurring: false };
  }

  return { unit, interval: interval ?? 1, isRecurring: true };
}

function parseMonthRange(month: string): { start: Date; end: Date } {
  const [year, monthIndex] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthIndex - 1, 1)),
    end: new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999)),
  };
}

/** Absolute URLs are catalog logos; anything else is an S3 key we uploaded. */
function isStorageKey(value: string | null | undefined): boolean {
  return !!value && !value.startsWith('http');
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

/** UTC to match the recurrence arithmetic; a local-time key drifts by a day. */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
