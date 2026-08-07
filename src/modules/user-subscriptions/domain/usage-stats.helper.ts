import { Prisma } from '@prisma/client';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_AGE_DAYS = 14;
const MIN_CHECKINS_14D = 5;
const ZOMBIE_USAGE_THRESHOLD = 0.2;

export interface UsageLogLike {
  date: Date;
  used: boolean;
}

export interface UsageStats {
  /** null when there isn't enough signal yet (fewer than MIN_CHECKINS_14D check-ins in the last 14 days). */
  usageRate14d: number | null;
  checkInCount14d: number;
  usedCount30d: number;
  /** null when there were zero uses in the last 30 days, or when the subscription is a one-time charge with no run rate — shown as "sin uso registrado", not a misleading number. */
  costPerUse30d: Prisma.Decimal | null;
  lastUsedAt: Date | null;
  isZombieCandidate: boolean;
}

/**
 * Derives usage/zombie metrics from daily check-in logs. Pure function so it
 * can be reused identically by the per-subscription endpoint and the
 * aggregate zombie list — one implementation of the rule, no drift.
 */
export function computeUsageStats(
  logs: UsageLogLike[],
  monthlyEquivalentAmount: Prisma.Decimal,
  startedAt: Date,
  now: Date = new Date(),
): UsageStats {
  const ageDays = (now.getTime() - startedAt.getTime()) / MS_PER_DAY;
  const isOldEnough = ageDays >= MIN_AGE_DAYS;

  const cutoff14d = new Date(now.getTime() - 14 * MS_PER_DAY);
  const cutoff30d = new Date(now.getTime() - 30 * MS_PER_DAY);

  const logs14d = logs.filter((l) => l.date >= cutoff14d && l.date <= now);
  const checkInCount14d = logs14d.length;
  const usedCount14d = logs14d.filter((l) => l.used).length;

  const usageRate14d = checkInCount14d >= MIN_CHECKINS_14D ? usedCount14d / checkInCount14d : null;

  const usedLogs30d = logs.filter((l) => l.date >= cutoff30d && l.date <= now && l.used);
  const usedCount30d = usedLogs30d.length;

  // A one-time charge has no monthly run rate, so there is no honest
  // cost-per-use to report — "$0 per use" would read as free.
  const hasRunRate = !monthlyEquivalentAmount.isZero();
  const costPerUse30d =
    usedCount30d > 0 && hasRunRate ? monthlyEquivalentAmount.div(usedCount30d) : null;

  const usedLogsAll = logs.filter((l) => l.used);
  const lastUsedAt = usedLogsAll.length > 0
    ? usedLogsAll.reduce((latest, l) => (l.date > latest ? l.date : latest), usedLogsAll[0].date)
    : null;

  const isZombieCandidate = isOldEnough && usageRate14d !== null && usageRate14d < ZOMBIE_USAGE_THRESHOLD;

  return { usageRate14d, checkInCount14d, usedCount30d, costPerUse30d, lastUsedAt, isZombieCandidate };
}
