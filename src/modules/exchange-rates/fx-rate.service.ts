import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import appConfig from '../../common/config/config.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { ExchangeRatesRepository } from './exchange-rates.repository.js';
import { FX_PROVIDER, type FxProvider, type FxRateTable } from './providers/fx-provider.interface.js';
import { convertAmount, crossRate, rebase } from './domain/fx-conversion.helper.js';

export interface FxRatesResult {
  table: FxRateTable | null;
  /** Rates were served from a cache older than the provider's refresh window. */
  stale: boolean;
  /** No rates at all — every conversion must degrade to null. */
  unavailable: boolean;
}

export interface FxConversionResult {
  amount: Prisma.Decimal;
  rate: Prisma.Decimal;
  ratesAsOf: Date;
  stale: boolean;
}

/** Serialized form in Redis — dates survive JSON as ISO strings. */
interface CachedTable extends Omit<FxRateTable, 'ratesAsOf' | 'nextUpdateAt'> {
  ratesAsOf: string;
  nextUpdateAt: string | null;
}

@Injectable()
export class FxRateService {
  private readonly logger = new Logger(FxRateService.name);
  private readonly fx: ConfigType<typeof appConfig>['fx'];

  constructor(
    @Inject(appConfig.KEY) config: ConfigType<typeof appConfig>,
    @Inject(FX_PROVIDER) private readonly provider: FxProvider,
    private readonly redisCacheService: RedisCacheService,
    private readonly exchangeRatesRepository: ExchangeRatesRepository,
  ) {
    this.fx = config.fx;
  }

  get attribution(): string {
    return this.provider.attribution;
  }

  /**
   * Rate table for `base`, resolved in this order:
   *   Redis -> fresh database snapshot -> provider HTTP -> stale snapshot -> nothing.
   *
   * Never throws: a conversion failure must degrade a summary, not 500 it.
   */
  async getRates(base?: string): Promise<FxRatesResult> {
    const requested = (base ?? this.fx.baseCurrency).trim().toUpperCase();

    if (!this.fx.enabled) {
      return { table: null, stale: false, unavailable: true };
    }

    // Only ever fetch the single configured pivot base; everything else is
    // derived in memory. One HTTP call a day covers the whole platform.
    const pivot = await this.getPivotTable();

    if (!pivot.table) return pivot;

    const rebased = rebase(pivot.table, requested);
    if (!rebased) {
      this.logger.warn(`Cannot rebase FX table onto "${requested}": missing from the provider's rates`);
      return { table: null, stale: pivot.stale, unavailable: true };
    }

    return { table: rebased, stale: pivot.stale, unavailable: false };
  }

  /** Cross-rate between two currencies, or null when unavailable. */
  async getRate(from: string, to: string): Promise<Prisma.Decimal | null> {
    const { table } = await this.getPivotTable();
    if (!table) return null;
    return crossRate(table, from, to);
  }

  /**
   * Converts a single amount. `decimalDigits` should come from the target
   * currency's ISO minor unit so rounding matches how the money is written.
   */
  async convert(
    amount: Prisma.Decimal,
    from: string,
    to: string,
    decimalDigits = 2,
  ): Promise<FxConversionResult | null> {
    const { table, stale } = await this.getPivotTable();
    if (!table) return null;

    const converted = convertAmount(amount, table, from, to, decimalDigits);
    if (!converted) return null;

    return { amount: converted.amount, rate: converted.rate, ratesAsOf: table.ratesAsOf, stale };
  }

  /**
   * The pivot table, cached. Callers that convert many amounts in one request
   * should call this once and reuse the table rather than calling convert()
   * per row.
   */
  async getPivotTable(): Promise<FxRatesResult> {
    if (!this.fx.enabled) {
      return { table: null, stale: false, unavailable: true };
    }

    const base = this.fx.baseCurrency.trim().toUpperCase();
    const cacheKey = this.cacheKey(base);

    const cached = await this.readCache(cacheKey);
    if (cached) return { table: cached, stale: false, unavailable: false };

    const snapshot = await this.exchangeRatesRepository
      .findSnapshot(this.provider.name, base)
      .catch((error: unknown) => {
        this.logger.warn(`Could not read the FX snapshot: ${describe(error)}`);
        return null;
      });

    if (snapshot && !this.isSnapshotStale(snapshot.table, snapshot.fetchedAt)) {
      const table = { ...snapshot.table, attribution: this.provider.attribution };
      await this.writeCache(cacheKey, table);
      return { table, stale: false, unavailable: false };
    }

    try {
      const fresh = await this.provider.fetchLatest(base);
      await this.writeCache(cacheKey, fresh);
      await this.exchangeRatesRepository.upsertSnapshot(fresh).catch((error: unknown) => {
        this.logger.warn(`Could not persist the FX snapshot: ${describe(error)}`);
      });
      return { table: fresh, stale: false, unavailable: false };
    } catch (error: unknown) {
      // Expected on a free, unauthenticated endpoint — warn, don't error.
      this.logger.warn(`FX provider "${this.provider.name}" unavailable: ${describe(error)}`);
    }

    if (snapshot) {
      return {
        table: { ...snapshot.table, attribution: this.provider.attribution },
        stale: true,
        unavailable: false,
      };
    }

    return { table: null, stale: false, unavailable: true };
  }

  private cacheKey(base: string): string {
    return `fx:rates:${this.provider.name}:${base}`;
  }

  private async readCache(key: string): Promise<FxRateTable | null> {
    try {
      const cached = await this.redisCacheService.get<CachedTable>(key);
      if (!cached?.rates) return null;

      return {
        ...cached,
        ratesAsOf: new Date(cached.ratesAsOf),
        nextUpdateAt: cached.nextUpdateAt ? new Date(cached.nextUpdateAt) : null,
      };
    } catch (error: unknown) {
      this.logger.warn(`Could not read FX rates from Redis: ${describe(error)}`);
      return null;
    }
  }

  private async writeCache(key: string, table: FxRateTable): Promise<void> {
    try {
      await this.redisCacheService.set(key, table, this.resolveTtlSeconds(table));
    } catch (error: unknown) {
      this.logger.warn(`Could not cache FX rates in Redis: ${describe(error)}`);
    }
  }

  /**
   * Expire roughly when the provider publishes its next refresh rather than a
   * fixed 24h from now, so the cache doesn't drift a little further out of date
   * with every miss. Jitter keeps a fleet from stampeding at the same second.
   */
  private resolveTtlSeconds(table: FxRateTable): number {
    const configured = this.fx.cacheTtlSeconds;
    if (!table.nextUpdateAt) return configured;

    const untilRefresh = Math.floor((table.nextUpdateAt.getTime() - Date.now()) / 1000);
    if (untilRefresh <= 0) return Math.min(configured, 300);

    const jitter = Math.floor(Math.random() * 600);
    return Math.min(configured, untilRefresh + jitter);
  }

  private isSnapshotStale(table: FxRateTable, fetchedAt: Date): boolean {
    if (table.nextUpdateAt) return table.nextUpdateAt.getTime() <= Date.now();
    return Date.now() - fetchedAt.getTime() > this.fx.cacheTtlSeconds * 1000;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
