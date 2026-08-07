import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { FxRateTable } from './providers/fx-provider.interface.js';

export interface StoredSnapshot {
  table: FxRateTable;
  fetchedAt: Date;
}

/**
 * Durable persistence for FX rates. Redis is the hot cache; this exists so a
 * cold Redis plus an unreachable provider still yields a usable (if stale)
 * rate table instead of losing conversion entirely.
 */
@Injectable()
export class ExchangeRatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSnapshot(provider: string, baseCurrency: string): Promise<StoredSnapshot | null> {
    const raw = await this.prisma.exchangeRateSnapshot.findUnique({
      where: { provider_baseCurrency: { provider, baseCurrency } },
    });

    if (!raw) return null;

    return {
      fetchedAt: raw.fetchedAt,
      table: {
        base: raw.baseCurrency,
        rates: raw.rates as Record<string, number>,
        ratesAsOf: raw.ratesAsOf,
        nextUpdateAt: raw.nextUpdateAt,
        provider: raw.provider,
        attribution: '',
      },
    };
  }

  async upsertSnapshot(table: FxRateTable): Promise<void> {
    const payload = {
      rates: table.rates,
      ratesAsOf: table.ratesAsOf,
      nextUpdateAt: table.nextUpdateAt,
      fetchedAt: new Date(),
    };

    await this.prisma.exchangeRateSnapshot.upsert({
      where: { provider_baseCurrency: { provider: table.provider, baseCurrency: table.base } },
      update: payload,
      create: { provider: table.provider, baseCurrency: table.base, ...payload },
    });
  }
}
