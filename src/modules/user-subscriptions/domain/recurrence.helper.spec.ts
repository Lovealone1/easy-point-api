import { Prisma, RecurrenceUnit } from '@prisma/client';
import {
  addRecurrence,
  projectOccurrences,
  subtractRecurrence,
  toMonthlyAmount,
  type Recurrence,
} from './recurrence.helper.js';

function every(unit: RecurrenceUnit, interval = 1, isRecurring = true): Recurrence {
  return { unit, interval, isRecurring };
}

const ONE_TIME: Recurrence = { unit: RecurrenceUnit.MONTH, interval: 1, isRecurring: false };

describe('recurrence.helper', () => {
  describe('toMonthlyAmount', () => {
    it('returns the same amount for a monthly charge', () => {
      expect(toMonthlyAmount(new Prisma.Decimal(100), every(RecurrenceUnit.MONTH)).toFixed(2)).toBe('100.00');
    });

    it('divides by 12 for a yearly charge', () => {
      expect(toMonthlyAmount(new Prisma.Decimal(1200), every(RecurrenceUnit.YEAR)).toFixed(2)).toBe('100.00');
    });

    it('divides by 3 for a quarterly charge', () => {
      expect(toMonthlyAmount(new Prisma.Decimal(300), every(RecurrenceUnit.QUARTER)).toFixed(2)).toBe('100.00');
    });

    it('divides by 6 for a semiannual charge', () => {
      expect(toMonthlyAmount(new Prisma.Decimal(600), every(RecurrenceUnit.SEMESTER)).toFixed(2)).toBe('100.00');
    });

    it('scales a weekly charge by weeks per month', () => {
      // 100 / (1 / 4.348214) = 434.82
      expect(toMonthlyAmount(new Prisma.Decimal(100), every(RecurrenceUnit.WEEK)).toFixed(2)).toBe('434.82');
    });

    it('scales a daily charge by days per month', () => {
      expect(toMonthlyAmount(new Prisma.Decimal(10), every(RecurrenceUnit.DAY)).toFixed(2)).toBe('304.38');
    });

    it('halves the run rate when the interval doubles', () => {
      const single = toMonthlyAmount(new Prisma.Decimal(100), every(RecurrenceUnit.MONTH, 1));
      const doubled = toMonthlyAmount(new Prisma.Decimal(100), every(RecurrenceUnit.MONTH, 2));
      expect(doubled.toFixed(2)).toBe('50.00');
      expect(single.div(2).toFixed(2)).toBe(doubled.toFixed(2));
    });

    it('handles "every 2 weeks"', () => {
      expect(toMonthlyAmount(new Prisma.Decimal(100), every(RecurrenceUnit.WEEK, 2)).toFixed(2)).toBe('217.41');
    });

    it('contributes nothing for a one-time charge', () => {
      expect(toMonthlyAmount(new Prisma.Decimal(500), ONE_TIME).toFixed(2)).toBe('0.00');
    });
  });

  describe('addRecurrence / subtractRecurrence', () => {
    it('adds a single day', () => {
      const result = addRecurrence(new Date('2026-01-01T00:00:00.000Z'), every(RecurrenceUnit.DAY));
      expect(result.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    });

    it('adds 7 days for a weekly charge', () => {
      const result = addRecurrence(new Date('2026-01-01T00:00:00.000Z'), every(RecurrenceUnit.WEEK));
      expect(result.toISOString()).toBe('2026-01-08T00:00:00.000Z');
    });

    it('adds one month', () => {
      const result = addRecurrence(new Date('2026-01-15T00:00:00.000Z'), every(RecurrenceUnit.MONTH));
      expect(result.toISOString()).toBe('2026-02-15T00:00:00.000Z');
    });

    it('adds three months for a quarterly charge', () => {
      const result = addRecurrence(new Date('2026-01-15T00:00:00.000Z'), every(RecurrenceUnit.QUARTER));
      expect(result.toISOString()).toBe('2026-04-15T00:00:00.000Z');
    });

    it('adds six months for a semiannual charge', () => {
      const result = addRecurrence(new Date('2026-01-15T00:00:00.000Z'), every(RecurrenceUnit.SEMESTER));
      expect(result.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    });

    it('adds one year', () => {
      const result = addRecurrence(new Date('2026-01-15T00:00:00.000Z'), every(RecurrenceUnit.YEAR));
      expect(result.toISOString()).toBe('2027-01-15T00:00:00.000Z');
    });

    it('honours an interval greater than one', () => {
      const result = addRecurrence(new Date('2026-01-15T00:00:00.000Z'), every(RecurrenceUnit.MONTH, 3));
      expect(result.toISOString()).toBe('2026-04-15T00:00:00.000Z');
    });

    it('clamps Jan 31 to the end of February instead of spilling into March', () => {
      const result = addRecurrence(new Date('2026-01-31T00:00:00.000Z'), every(RecurrenceUnit.MONTH));
      expect(result.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    });

    it('clamps Jan 31 to Feb 29 in a leap year', () => {
      const result = addRecurrence(new Date('2028-01-31T00:00:00.000Z'), every(RecurrenceUnit.MONTH));
      expect(result.toISOString()).toBe('2028-02-29T00:00:00.000Z');
    });

    it('clamps Feb 29 to Feb 28 one year later', () => {
      const result = addRecurrence(new Date('2028-02-29T00:00:00.000Z'), every(RecurrenceUnit.YEAR));
      expect(result.toISOString()).toBe('2029-02-28T00:00:00.000Z');
    });

    it('is its own inverse for a mid-month date', () => {
      const start = new Date('2026-03-10T00:00:00.000Z');
      const forward = addRecurrence(start, every(RecurrenceUnit.MONTH));
      expect(subtractRecurrence(forward, every(RecurrenceUnit.MONTH)).toISOString()).toBe(start.toISOString());
    });

    it('does not mutate the input date', () => {
      const start = new Date('2026-01-01T00:00:00.000Z');
      addRecurrence(start, every(RecurrenceUnit.MONTH));
      expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('projectOccurrences', () => {
    const januaryStart = new Date('2026-01-01T00:00:00.000Z');
    const januaryEnd = new Date('2026-01-31T23:59:59.999Z');

    it('finds every weekly occurrence within a one-month range', () => {
      const occurrences = projectOccurrences(
        new Date('2026-01-05T00:00:00.000Z'),
        every(RecurrenceUnit.WEEK),
        januaryStart,
        januaryEnd,
      );

      expect(occurrences.map((d) => d.toISOString().slice(0, 10))).toEqual([
        '2026-01-05',
        '2026-01-12',
        '2026-01-19',
        '2026-01-26',
      ]);
    });

    it('finds one occurrence per day for a daily charge without hitting the guard', () => {
      const occurrences = projectOccurrences(
        januaryStart,
        every(RecurrenceUnit.DAY),
        januaryStart,
        januaryEnd,
      );

      expect(occurrences).toHaveLength(31);
    });

    it('spaces occurrences out when the interval is greater than one', () => {
      const occurrences = projectOccurrences(
        new Date('2026-01-05T00:00:00.000Z'),
        every(RecurrenceUnit.WEEK, 2),
        januaryStart,
        januaryEnd,
      );

      expect(occurrences.map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-01-05', '2026-01-19']);
    });

    it('returns a single occurrence for a monthly charge inside the month', () => {
      const occurrences = projectOccurrences(
        new Date('2026-08-10T00:00:00.000Z'),
        every(RecurrenceUnit.MONTH),
        new Date('2026-08-01T00:00:00.000Z'),
        new Date('2026-08-31T23:59:59.999Z'),
      );

      expect(occurrences).toHaveLength(1);
      expect(occurrences[0].toISOString().slice(0, 10)).toBe('2026-08-10');
    });

    it('returns nothing for a yearly charge outside the range', () => {
      const occurrences = projectOccurrences(
        new Date('2026-11-01T00:00:00.000Z'),
        every(RecurrenceUnit.YEAR),
        new Date('2026-08-01T00:00:00.000Z'),
        new Date('2026-08-31T23:59:59.999Z'),
      );

      expect(occurrences).toHaveLength(0);
    });

    it('walks backward to find occurrences before nextBillingDate', () => {
      const occurrences = projectOccurrences(
        new Date('2026-10-10T00:00:00.000Z'),
        every(RecurrenceUnit.MONTH),
        new Date('2026-08-01T00:00:00.000Z'),
        new Date('2026-08-31T23:59:59.999Z'),
      );

      expect(occurrences).toHaveLength(1);
      expect(occurrences[0].toISOString().slice(0, 10)).toBe('2026-08-10');
    });

    it('yields a one-time charge exactly once when it falls inside the range', () => {
      const occurrences = projectOccurrences(
        new Date('2026-01-15T00:00:00.000Z'),
        ONE_TIME,
        januaryStart,
        januaryEnd,
      );

      expect(occurrences.map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-01-15']);
    });

    it('omits a one-time charge that falls outside the range', () => {
      const occurrences = projectOccurrences(
        new Date('2026-02-15T00:00:00.000Z'),
        ONE_TIME,
        januaryStart,
        januaryEnd,
      );

      expect(occurrences).toHaveLength(0);
    });
  });
});
