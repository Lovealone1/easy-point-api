import { Prisma } from '@prisma/client';
import { computeUsageStats, UsageLogLike } from './usage-stats.helper.js';

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

describe('computeUsageStats', () => {
  const now = new Date('2026-08-06T00:00:00.000Z');
  const monthlyEquivalent = new Prisma.Decimal(39900);
  const oldEnoughStartedAt = daysAgo(now, 30);

  it('returns null usageRate14d when there are fewer than 5 check-ins in the last 14 days', () => {
    const logs: UsageLogLike[] = [
      { date: daysAgo(now, 1), used: true },
      { date: daysAgo(now, 2), used: false },
    ];

    const stats = computeUsageStats(logs, monthlyEquivalent, oldEnoughStartedAt, now);

    expect(stats.usageRate14d).toBeNull();
    expect(stats.isZombieCandidate).toBe(false);
  });

  it('flags a subscription as a zombie candidate when usage rate is below 20%', () => {
    const logs: UsageLogLike[] = [
      { date: daysAgo(now, 0), used: true },
      { date: daysAgo(now, 1), used: false },
      { date: daysAgo(now, 2), used: false },
      { date: daysAgo(now, 3), used: false },
      { date: daysAgo(now, 4), used: false },
      { date: daysAgo(now, 5), used: false },
    ];

    const stats = computeUsageStats(logs, monthlyEquivalent, oldEnoughStartedAt, now);

    expect(stats.usageRate14d).toBeCloseTo(1 / 6);
    expect(stats.isZombieCandidate).toBe(true);
  });

  it('does not flag a subscription at exactly the 20% threshold (strict less-than)', () => {
    const logs: UsageLogLike[] = [
      { date: daysAgo(now, 0), used: true },
      { date: daysAgo(now, 1), used: false },
      { date: daysAgo(now, 2), used: false },
      { date: daysAgo(now, 3), used: false },
      { date: daysAgo(now, 4), used: false },
    ];

    const stats = computeUsageStats(logs, monthlyEquivalent, oldEnoughStartedAt, now);

    expect(stats.usageRate14d).toBe(0.2);
    expect(stats.isZombieCandidate).toBe(false);
  });

  it('does not flag a subscription younger than 14 days even with low usage', () => {
    const brandNewStartedAt = daysAgo(now, 5);
    const logs: UsageLogLike[] = [
      { date: daysAgo(now, 0), used: false },
      { date: daysAgo(now, 1), used: false },
      { date: daysAgo(now, 2), used: false },
      { date: daysAgo(now, 3), used: false },
      { date: daysAgo(now, 4), used: false },
    ];

    const stats = computeUsageStats(logs, monthlyEquivalent, brandNewStartedAt, now);

    expect(stats.isZombieCandidate).toBe(false);
  });

  it('ignores check-ins outside the 14-day window when computing usageRate14d', () => {
    const logs: UsageLogLike[] = [
      { date: daysAgo(now, 0), used: true },
      { date: daysAgo(now, 1), used: true },
      { date: daysAgo(now, 2), used: true },
      { date: daysAgo(now, 3), used: true },
      { date: daysAgo(now, 4), used: true },
      // Outside the 14-day window — must not affect usageRate14d.
      { date: daysAgo(now, 20), used: false },
      { date: daysAgo(now, 21), used: false },
    ];

    const stats = computeUsageStats(logs, monthlyEquivalent, oldEnoughStartedAt, now);

    expect(stats.usageRate14d).toBe(1);
    expect(stats.checkInCount14d).toBe(5);
  });

  it('computes costPerUse30d from uses in the last 30 days', () => {
    const logs: UsageLogLike[] = [
      { date: daysAgo(now, 1), used: true },
      { date: daysAgo(now, 10), used: true },
      { date: daysAgo(now, 20), used: true },
    ];

    const stats = computeUsageStats(logs, monthlyEquivalent, oldEnoughStartedAt, now);

    expect(stats.usedCount30d).toBe(3);
    expect(stats.costPerUse30d?.toFixed(2)).toBe(new Prisma.Decimal(39900).div(3).toFixed(2));
  });

  it('returns null costPerUse30d when there were zero uses in the last 30 days', () => {
    const logs: UsageLogLike[] = [
      { date: daysAgo(now, 1), used: false },
      { date: daysAgo(now, 2), used: false },
    ];

    const stats = computeUsageStats(logs, monthlyEquivalent, oldEnoughStartedAt, now);

    expect(stats.costPerUse30d).toBeNull();
  });

  it('returns the most recent used date as lastUsedAt', () => {
    const mostRecent = daysAgo(now, 1);
    const logs: UsageLogLike[] = [
      { date: daysAgo(now, 10), used: true },
      { date: mostRecent, used: true },
      { date: daysAgo(now, 5), used: false },
    ];

    const stats = computeUsageStats(logs, monthlyEquivalent, oldEnoughStartedAt, now);

    expect(stats.lastUsedAt).toEqual(mostRecent);
  });

  it('returns null lastUsedAt when there are no used=true logs', () => {
    const logs: UsageLogLike[] = [{ date: daysAgo(now, 1), used: false }];

    const stats = computeUsageStats(logs, monthlyEquivalent, oldEnoughStartedAt, now);

    expect(stats.lastUsedAt).toBeNull();
  });
});
