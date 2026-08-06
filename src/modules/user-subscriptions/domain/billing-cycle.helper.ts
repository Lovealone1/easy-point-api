import { BillingCycle, Prisma } from '@prisma/client';

const WEEKS_PER_MONTH = new Prisma.Decimal(4.345);

/** Normalizes any billing cycle to its monthly-equivalent amount. */
export function toMonthlyAmount(amount: Prisma.Decimal, cycle: BillingCycle): Prisma.Decimal {
  switch (cycle) {
    case BillingCycle.WEEKLY:
      return amount.mul(WEEKS_PER_MONTH);
    case BillingCycle.MONTHLY:
      return amount;
    case BillingCycle.QUARTERLY:
      return amount.div(3);
    case BillingCycle.YEARLY:
      return amount.div(12);
  }
}

/** Adds one billing cycle to a date, used to derive the next charge date. */
export function addCycle(date: Date, cycle: BillingCycle): Date {
  const result = new Date(date);
  switch (cycle) {
    case BillingCycle.WEEKLY:
      result.setDate(result.getDate() + 7);
      break;
    case BillingCycle.MONTHLY:
      result.setMonth(result.getMonth() + 1);
      break;
    case BillingCycle.QUARTERLY:
      result.setMonth(result.getMonth() + 3);
      break;
    case BillingCycle.YEARLY:
      result.setFullYear(result.getFullYear() + 1);
      break;
  }
  return result;
}
