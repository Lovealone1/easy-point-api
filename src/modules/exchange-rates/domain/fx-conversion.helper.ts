import { Prisma } from '@prisma/client';
import type { FxRateTable } from '../providers/fx-provider.interface.js';

/**
 * Cross-rate between two currencies, derived from a single pivot table.
 *
 * Everything is done in Prisma.Decimal — a subscription amount multiplied by a
 * float rate is exactly the kind of money math that drifts by a cent and then
 * gets reported as a bug.
 *
 * Returns null when either side is missing from the table, so callers can
 * degrade instead of guessing.
 */
export function crossRate(table: FxRateTable, from: string, to: string): Prisma.Decimal | null {
  const fromCode = from.trim().toUpperCase();
  const toCode = to.trim().toUpperCase();

  if (fromCode === toCode) return new Prisma.Decimal(1);

  const fromRate = rateFor(table, fromCode);
  const toRate = rateFor(table, toCode);

  if (fromRate === null || toRate === null || fromRate.isZero()) return null;

  return toRate.div(fromRate);
}

/**
 * Converts an amount, rounding once at the end to the target currency's minor
 * unit. Intermediate math stays unrounded on purpose.
 */
export function convertAmount(
  amount: Prisma.Decimal,
  table: FxRateTable,
  from: string,
  to: string,
  decimalDigits = 2,
): { amount: Prisma.Decimal; rate: Prisma.Decimal } | null {
  const rate = crossRate(table, from, to);
  if (rate === null) return null;

  const converted = amount.mul(rate).toDecimalPlaces(decimalDigits, Prisma.Decimal.ROUND_HALF_UP);
  return { amount: converted, rate };
}

/**
 * Rebases a pivot table onto a different base without another network call.
 */
export function rebase(table: FxRateTable, newBase: string): FxRateTable | null {
  const code = newBase.trim().toUpperCase();
  if (code === table.base.toUpperCase()) return table;

  const baseRate = rateFor(table, code);
  if (baseRate === null || baseRate.isZero()) return null;

  const rates: Record<string, number> = {};
  for (const [currency, value] of Object.entries(table.rates)) {
    rates[currency] = new Prisma.Decimal(value).div(baseRate).toNumber();
  }
  // The old base is 1 unit of itself, which the loop above already covers only
  // if the provider echoed it back. Make it explicit.
  rates[table.base.toUpperCase()] ??= new Prisma.Decimal(1).div(baseRate).toNumber();

  return { ...table, base: code, rates };
}

function rateFor(table: FxRateTable, code: string): Prisma.Decimal | null {
  if (code === table.base.toUpperCase()) return new Prisma.Decimal(1);

  const raw = table.rates[code];
  if (raw === undefined || raw === null || !Number.isFinite(raw)) return null;

  return new Prisma.Decimal(raw);
}
