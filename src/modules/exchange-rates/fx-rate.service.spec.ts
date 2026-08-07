import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import appConfig from '../../common/config/config.js';
import { FxRateService } from './fx-rate.service.js';
import { ExchangeRatesRepository } from './exchange-rates.repository.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { FX_PROVIDER, type FxRateTable } from './providers/fx-provider.interface.js';

const ATTRIBUTION = 'Rates By Exchange Rate API';

function buildTable(overrides: Partial<FxRateTable> = {}): FxRateTable {
  return {
    base: 'USD',
    rates: { USD: 1, COP: 4012.5, EUR: 0.92 },
    ratesAsOf: new Date('2026-08-06T00:00:00.000Z'),
    nextUpdateAt: new Date('2026-08-07T00:00:00.000Z'),
    provider: 'open-er-api',
    attribution: ATTRIBUTION,
    ...overrides,
  };
}

describe('FxRateService', () => {
  let service: FxRateService;
  let redis: { get: jest.Mock; set: jest.Mock };
  let repository: { findSnapshot: jest.Mock; upsertSnapshot: jest.Mock };
  let provider: { name: string; attribution: string; fetchLatest: jest.Mock };

  async function build(fxOverrides: Record<string, unknown> = {}) {
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    repository = {
      findSnapshot: jest.fn().mockResolvedValue(null),
      upsertSnapshot: jest.fn().mockResolvedValue(undefined),
    };
    provider = {
      name: 'open-er-api',
      attribution: ATTRIBUTION,
      fetchLatest: jest.fn().mockResolvedValue(buildTable()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxRateService,
        { provide: FX_PROVIDER, useValue: provider },
        { provide: RedisCacheService, useValue: redis },
        { provide: ExchangeRatesRepository, useValue: repository },
        {
          provide: appConfig.KEY,
          useValue: {
            fx: {
              provider: 'open-er-api',
              baseUrl: 'https://open.er-api.com/v6/latest',
              apiKey: '',
              baseCurrency: 'USD',
              cacheTtlSeconds: 86_400,
              requestTimeoutMs: 5_000,
              enabled: true,
              ...fxOverrides,
            },
          },
        },
      ],
    }).compile();

    service = module.get(FxRateService);
  }

  beforeEach(() => build());

  describe('resolution order', () => {
    it('serves a Redis hit without touching the database or the provider', async () => {
      redis.get.mockResolvedValueOnce({
        ...buildTable(),
        ratesAsOf: '2026-08-06T00:00:00.000Z',
        nextUpdateAt: '2026-08-07T00:00:00.000Z',
      });

      const result = await service.getPivotTable();

      expect(result.unavailable).toBe(false);
      expect(result.stale).toBe(false);
      expect(result.table!.ratesAsOf).toBeInstanceOf(Date);
      expect(repository.findSnapshot).not.toHaveBeenCalled();
      expect(provider.fetchLatest).not.toHaveBeenCalled();
    });

    it('falls back to a fresh database snapshot and warms Redis', async () => {
      repository.findSnapshot.mockResolvedValueOnce({
        table: buildTable({ nextUpdateAt: new Date(Date.now() + 3_600_000) }),
        fetchedAt: new Date(),
      });

      const result = await service.getPivotTable();

      expect(result.stale).toBe(false);
      expect(provider.fetchLatest).not.toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
    });

    it('fetches from the provider when both caches miss, then writes both', async () => {
      const result = await service.getPivotTable();

      expect(provider.fetchLatest).toHaveBeenCalledWith('USD');
      expect(redis.set).toHaveBeenCalled();
      expect(repository.upsertSnapshot).toHaveBeenCalled();
      expect(result.unavailable).toBe(false);
    });

    it('refetches when the database snapshot is past its refresh window', async () => {
      repository.findSnapshot.mockResolvedValueOnce({
        table: buildTable({ nextUpdateAt: new Date(Date.now() - 3_600_000) }),
        fetchedAt: new Date(Date.now() - 90_000_000),
      });

      await service.getPivotTable();

      expect(provider.fetchLatest).toHaveBeenCalled();
    });
  });

  describe('degradation', () => {
    it('serves a stale snapshot when the provider is down', async () => {
      repository.findSnapshot.mockResolvedValueOnce({
        table: buildTable({ nextUpdateAt: new Date(Date.now() - 3_600_000) }),
        fetchedAt: new Date(Date.now() - 90_000_000),
      });
      provider.fetchLatest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await service.getPivotTable();

      expect(result.stale).toBe(true);
      expect(result.unavailable).toBe(false);
      expect(result.table!.rates.COP).toBe(4012.5);
    });

    it('reports unavailable rather than throwing when nothing is cached and the provider fails', async () => {
      provider.fetchLatest.mockRejectedValueOnce(new Error('timeout'));

      const result = await service.getPivotTable();

      expect(result.unavailable).toBe(true);
      expect(result.table).toBeNull();
    });

    it('survives a Redis outage by falling through to the provider', async () => {
      redis.get.mockRejectedValueOnce(new Error('redis down'));
      redis.set.mockRejectedValueOnce(new Error('redis down'));

      const result = await service.getPivotTable();

      expect(result.unavailable).toBe(false);
      expect(provider.fetchLatest).toHaveBeenCalled();
    });

    it('short-circuits when FX is disabled', async () => {
      await build({ enabled: false });

      const result = await service.getPivotTable();

      expect(result.unavailable).toBe(true);
      expect(provider.fetchLatest).not.toHaveBeenCalled();
    });
  });

  describe('cache TTL', () => {
    it('expires around the provider refresh instead of a flat 24h', async () => {
      const oneHourOut = new Date(Date.now() + 3_600_000);
      provider.fetchLatest.mockResolvedValueOnce(buildTable({ nextUpdateAt: oneHourOut }));

      await service.getPivotTable();

      const ttl = redis.set.mock.calls[0][2] as number;
      // ~3600s plus up to 600s of jitter.
      expect(ttl).toBeGreaterThanOrEqual(3_590);
      expect(ttl).toBeLessThanOrEqual(4_210);
    });

    it('never exceeds the configured ceiling', async () => {
      provider.fetchLatest.mockResolvedValueOnce(
        buildTable({ nextUpdateAt: new Date(Date.now() + 10 * 86_400_000) }),
      );

      await service.getPivotTable();

      expect(redis.set.mock.calls[0][2]).toBeLessThanOrEqual(86_400);
    });
  });

  describe('conversion', () => {
    it('converts across a cross-rate', async () => {
      const result = await service.convert(new Prisma.Decimal('9.99'), 'USD', 'COP', 2);
      expect(result!.amount.toFixed(2)).toBe('40084.88');
      expect(result!.stale).toBe(false);
    });

    it('returns null when rates are unavailable instead of throwing', async () => {
      provider.fetchLatest.mockRejectedValueOnce(new Error('down'));
      expect(await service.convert(new Prisma.Decimal('10'), 'USD', 'COP')).toBeNull();
    });

    it('rebases onto a requested non-pivot base without another fetch', async () => {
      const result = await service.getRates('COP');

      expect(result.table!.base).toBe('COP');
      expect(provider.fetchLatest).toHaveBeenCalledTimes(1);
    });

    it('reports unavailable for a base the provider does not quote', async () => {
      const result = await service.getRates('XXX');
      expect(result.unavailable).toBe(true);
    });
  });
});
