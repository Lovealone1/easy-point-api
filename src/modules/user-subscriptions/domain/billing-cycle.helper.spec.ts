import { BillingCycle, Prisma } from '@prisma/client';
import { addCycle, projectOccurrences, subtractCycle, toMonthlyAmount } from './billing-cycle.helper.js';

describe('billing-cycle.helper', () => {
  describe('toMonthlyAmount', () => {
    it('returns the same amount for MONTHLY', () => {
      const result = toMonthlyAmount(new Prisma.Decimal(100), BillingCycle.MONTHLY);
      expect(result.toFixed(2)).toBe('100.00');
    });

    it('divides by 12 for YEARLY', () => {
      const result = toMonthlyAmount(new Prisma.Decimal(1200), BillingCycle.YEARLY);
      expect(result.toFixed(2)).toBe('100.00');
    });

    it('divides by 3 for QUARTERLY', () => {
      const result = toMonthlyAmount(new Prisma.Decimal(300), BillingCycle.QUARTERLY);
      expect(result.toFixed(2)).toBe('100.00');
    });

    it('multiplies by ~4.345 for WEEKLY', () => {
      const result = toMonthlyAmount(new Prisma.Decimal(100), BillingCycle.WEEKLY);
      expect(result.toFixed(2)).toBe('434.50');
    });
  });

  describe('addCycle / subtractCycle', () => {
    it('adds 7 days for WEEKLY', () => {
      const result = addCycle(new Date('2026-01-01T00:00:00.000Z'), BillingCycle.WEEKLY);
      expect(result.toISOString()).toBe('2026-01-08T00:00:00.000Z');
    });

    it('adds 1 month for MONTHLY', () => {
      const result = addCycle(new Date('2026-01-15T00:00:00.000Z'), BillingCycle.MONTHLY);
      expect(result.toISOString()).toBe('2026-02-15T00:00:00.000Z');
    });

    it('adds 3 months for QUARTERLY', () => {
      const result = addCycle(new Date('2026-01-15T00:00:00.000Z'), BillingCycle.QUARTERLY);
      expect(result.toISOString()).toBe('2026-04-15T00:00:00.000Z');
    });

    it('adds 1 year for YEARLY', () => {
      const result = addCycle(new Date('2026-01-15T00:00:00.000Z'), BillingCycle.YEARLY);
      expect(result.toISOString()).toBe('2027-01-15T00:00:00.000Z');
    });

    it('subtractCycle is the inverse of addCycle', () => {
      const start = new Date('2026-03-10T00:00:00.000Z');
      const forward = addCycle(start, BillingCycle.MONTHLY);
      const back = subtractCycle(forward, BillingCycle.MONTHLY);
      expect(back.toISOString()).toBe(start.toISOString());
    });

    it('does not mutate the input date', () => {
      const start = new Date('2026-01-01T00:00:00.000Z');
      addCycle(start, BillingCycle.MONTHLY);
      expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('projectOccurrences', () => {
    it('finds every weekly occurrence within a one-month range', () => {
      const nextBillingDate = new Date('2026-01-05T00:00:00.000Z');
      const rangeStart = new Date('2026-01-01T00:00:00.000Z');
      const rangeEnd = new Date('2026-01-31T23:59:59.999Z');

      const occurrences = projectOccurrences(nextBillingDate, BillingCycle.WEEKLY, rangeStart, rangeEnd);

      expect(occurrences.map((d) => d.toISOString().slice(0, 10))).toEqual([
        '2026-01-05',
        '2026-01-12',
        '2026-01-19',
        '2026-01-26',
      ]);
    });

    it('returns a single occurrence for a monthly subscription within the month', () => {
      const nextBillingDate = new Date('2026-08-10T00:00:00.000Z');
      const rangeStart = new Date('2026-08-01T00:00:00.000Z');
      const rangeEnd = new Date('2026-08-31T23:59:59.999Z');

      const occurrences = projectOccurrences(nextBillingDate, BillingCycle.MONTHLY, rangeStart, rangeEnd);

      expect(occurrences).toHaveLength(1);
      expect(occurrences[0].toISOString().slice(0, 10)).toBe('2026-08-10');
    });

    it('returns no occurrences for a yearly subscription outside the month', () => {
      const nextBillingDate = new Date('2026-11-01T00:00:00.000Z');
      const rangeStart = new Date('2026-08-01T00:00:00.000Z');
      const rangeEnd = new Date('2026-08-31T23:59:59.999Z');

      const occurrences = projectOccurrences(nextBillingDate, BillingCycle.YEARLY, rangeStart, rangeEnd);

      expect(occurrences).toHaveLength(0);
    });

    it('walks backward to find occurrences before nextBillingDate', () => {
      // nextBillingDate is in a future month; the range asks about an earlier month.
      const nextBillingDate = new Date('2026-10-10T00:00:00.000Z');
      const rangeStart = new Date('2026-08-01T00:00:00.000Z');
      const rangeEnd = new Date('2026-08-31T23:59:59.999Z');

      const occurrences = projectOccurrences(nextBillingDate, BillingCycle.MONTHLY, rangeStart, rangeEnd);

      expect(occurrences).toHaveLength(1);
      expect(occurrences[0].toISOString().slice(0, 10)).toBe('2026-08-10');
    });
  });
});
