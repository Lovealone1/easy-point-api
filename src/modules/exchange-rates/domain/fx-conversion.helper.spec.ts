import { Prisma } from '@prisma/client';
import { convertAmount, crossRate, rebase } from './fx-conversion.helper.js';
import type { FxRateTable } from '../providers/fx-provider.interface.js';

const table: FxRateTable = {
  base: 'USD',
  rates: { USD: 1, COP: 4012.5, EUR: 0.92, JPY: 155.25 },
  ratesAsOf: new Date('2026-08-06T00:00:00.000Z'),
  nextUpdateAt: new Date('2026-08-07T00:00:00.000Z'),
  provider: 'open-er-api',
  attribution: 'Rates By Exchange Rate API',
};

describe('fx-conversion.helper', () => {
  describe('crossRate', () => {
    it('returns 1 for the same currency', () => {
      expect(crossRate(table, 'COP', 'COP')!.toFixed(2)).toBe('1.00');
    });

    it('reads a direct rate off the pivot base', () => {
      expect(crossRate(table, 'USD', 'COP')!.toFixed(2)).toBe('4012.50');
    });

    it('derives a cross-rate between two non-base currencies', () => {
      // 4012.5 / 0.92
      expect(crossRate(table, 'EUR', 'COP')!.toFixed(2)).toBe('4361.41');
    });

    it('inverts correctly back to the base', () => {
      expect(crossRate(table, 'COP', 'USD')!.toFixed(8)).toBe('0.00024922');
    });

    it('is case- and whitespace-insensitive', () => {
      expect(crossRate(table, ' usd ', 'cop')!.toFixed(2)).toBe('4012.50');
    });

    it('returns null for a currency the provider does not quote', () => {
      expect(crossRate(table, 'USD', 'XXX')).toBeNull();
      expect(crossRate(table, 'XXX', 'USD')).toBeNull();
    });
  });

  describe('convertAmount', () => {
    it('converts and rounds to the target minor unit', () => {
      const result = convertAmount(new Prisma.Decimal('9.99'), table, 'USD', 'COP', 2)!;
      expect(result.amount.toFixed(2)).toBe('40084.88');
    });

    it('rounds to whole units for a zero-decimal currency', () => {
      const result = convertAmount(new Prisma.Decimal('10'), table, 'USD', 'JPY', 0)!;
      expect(result.amount.toFixed(0)).toBe('1553');
    });

    it('keeps precision through a cross-rate rather than rounding twice', () => {
      // Rounding the EUR->USD leg first would drift; only the result is rounded.
      // 19.99 * (4012.5 / 0.92) = 87184.6494...
      const result = convertAmount(new Prisma.Decimal('19.99'), table, 'EUR', 'COP', 2)!;
      expect(result.amount.toFixed(2)).toBe('87184.65');
    });

    it('returns null when the pair is unavailable', () => {
      expect(convertAmount(new Prisma.Decimal('10'), table, 'USD', 'XXX', 2)).toBeNull();
    });
  });

  describe('rebase', () => {
    it('returns the table unchanged when already on that base', () => {
      expect(rebase(table, 'USD')).toBe(table);
    });

    it('re-expresses every rate against the new base', () => {
      const rebased = rebase(table, 'COP')!;
      expect(rebased.base).toBe('COP');
      expect(rebased.rates.COP).toBeCloseTo(1, 8);
      expect(rebased.rates.USD).toBeCloseTo(1 / 4012.5, 10);
    });

    it('preserves cross-rates through the rebase', () => {
      const rebased = rebase(table, 'EUR')!;
      expect(crossRate(rebased, 'EUR', 'COP')!.toFixed(2)).toBe('4361.41');
    });

    it('returns null for a base the provider does not quote', () => {
      expect(rebase(table, 'XXX')).toBeNull();
    });
  });
});
