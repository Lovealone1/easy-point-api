import { Prisma, RecurrenceUnit } from '@prisma/client';

/**
 * How often a personal subscription is charged.
 *
 * `isRecurring: false` means a one-time charge: it has no run rate and appears
 * exactly once in the cash-flow calendar.
 */
export interface Recurrence {
  unit: RecurrenceUnit;
  /** How many units between charges. "Every 2 months" is unit MONTH, interval 2. */
  interval: number;
  isRecurring: boolean;
}

/** 365.25 / 12 — averaged over a leap cycle so yearly totals stay consistent. */
const DAYS_PER_MONTH = new Prisma.Decimal('30.4375');
/** DAYS_PER_MONTH / 7. */
const WEEKS_PER_MONTH = new Prisma.Decimal('4.348214');

const ZERO = new Prisma.Decimal(0);

/** Guard against a pathological interval producing an unbounded projection. */
const MAX_OCCURRENCES = 1000;

/**
 * How many months one charge covers. Fractional for sub-monthly units — a
 * weekly charge covers roughly 0.23 of a month.
 */
function monthsPerOccurrence(recurrence: Recurrence): Prisma.Decimal {
  const interval = new Prisma.Decimal(Math.max(1, recurrence.interval));

  switch (recurrence.unit) {
    case RecurrenceUnit.DAY:
      return interval.div(DAYS_PER_MONTH);
    case RecurrenceUnit.WEEK:
      return interval.div(WEEKS_PER_MONTH);
    case RecurrenceUnit.MONTH:
      return interval;
    case RecurrenceUnit.QUARTER:
      return interval.mul(3);
    case RecurrenceUnit.SEMESTER:
      return interval.mul(6);
    case RecurrenceUnit.YEAR:
      return interval.mul(12);
    default: {
      // Compile-time exhaustiveness: a new RecurrenceUnit member breaks the build
      // here rather than silently falling through to a wrong number.
      const exhaustive: never = recurrence.unit;
      throw new Error(`Unhandled recurrence unit: ${String(exhaustive)}`);
    }
  }
}

/**
 * Normalizes any recurrence to its monthly-equivalent amount, so subscriptions
 * on different schedules can be compared and summed.
 *
 * A one-time charge contributes 0: it is not part of a monthly run rate.
 */
export function toMonthlyAmount(amount: Prisma.Decimal, recurrence: Recurrence): Prisma.Decimal {
  if (!recurrence.isRecurring) return ZERO;
  return amount.div(monthsPerOccurrence(recurrence));
}

/**
 * Adds months while clamping to the end of the target month, so the 31st of
 * January plus one month is the 28th/29th of February rather than spilling into
 * March the way a bare setUTCMonth does.
 */
function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const result = new Date(date);

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDayOfMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();

  result.setUTCDate(Math.min(day, lastDayOfMonth));
  return result;
}

/**
 * Shifts a date by `steps` recurrence periods. Negative steps go backward.
 *
 * All arithmetic is UTC: billing dates are calendar dates, not instants, and
 * local-time arithmetic drifts by a day whenever the server's timezone and the
 * user's disagree — or across a DST boundary.
 */
function shift(date: Date, recurrence: Recurrence, steps: number): Date {
  const interval = Math.max(1, recurrence.interval) * steps;

  switch (recurrence.unit) {
    case RecurrenceUnit.DAY: {
      const result = new Date(date);
      result.setUTCDate(result.getUTCDate() + interval);
      return result;
    }
    case RecurrenceUnit.WEEK: {
      const result = new Date(date);
      result.setUTCDate(result.getUTCDate() + interval * 7);
      return result;
    }
    case RecurrenceUnit.MONTH:
      return addMonths(date, interval);
    case RecurrenceUnit.QUARTER:
      return addMonths(date, interval * 3);
    case RecurrenceUnit.SEMESTER:
      return addMonths(date, interval * 6);
    case RecurrenceUnit.YEAR:
      return addMonths(date, interval * 12);
    default: {
      const exhaustive: never = recurrence.unit;
      throw new Error(`Unhandled recurrence unit: ${String(exhaustive)}`);
    }
  }
}

/** Adds one recurrence period, used to derive the next charge date. */
export function addRecurrence(date: Date, recurrence: Recurrence): Date {
  return shift(date, recurrence, 1);
}

/** Subtracts one recurrence period — the inverse of addRecurrence. */
export function subtractRecurrence(date: Date, recurrence: Recurrence): Date {
  return shift(date, recurrence, -1);
}

/**
 * Projects every occurrence of a charge within [rangeStart, rangeEnd], walking
 * backward from nextBillingDate first so occurrences earlier than it are found
 * too. A daily subscription can appear 31 times in a month; a yearly one may
 * not appear at all.
 *
 * A one-time charge yields at most its single date.
 */
export function projectOccurrences(
  nextBillingDate: Date,
  recurrence: Recurrence,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  if (!recurrence.isRecurring) {
    const withinRange = nextBillingDate >= rangeStart && nextBillingDate <= rangeEnd;
    return withinRange ? [new Date(nextBillingDate)] : [];
  }

  const occurrences: Date[] = [];

  // Walk backward first so the cursor starts at the first occurrence at or
  // after rangeStart.
  let cursor = new Date(nextBillingDate);
  let guard = 0;
  while (cursor > rangeStart && guard < MAX_OCCURRENCES) {
    const previous = subtractRecurrence(cursor, recurrence);
    if (previous < rangeStart) break;
    cursor = previous;
    guard++;
  }

  guard = 0;
  while (cursor <= rangeEnd && guard < MAX_OCCURRENCES) {
    if (cursor >= rangeStart) {
      occurrences.push(new Date(cursor));
    }
    cursor = addRecurrence(cursor, recurrence);
    guard++;
  }

  return occurrences;
}
