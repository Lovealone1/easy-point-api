import { resolveStatementWindow } from './billing-window.helper.js';

describe('resolveStatementWindow', () => {
  it('resolves the current cycle when referenceDate is before this month\'s statement day', () => {
    const window = resolveStatementWindow(15, new Date(2026, 7, 6)); // Aug 6, statementDay 15

    expect(window.cycleStart).toEqual(new Date(2026, 6, 15)); // Jul 15
    expect(window.cycleEnd).toEqual(new Date(2026, 7, 15)); // Aug 15
  });

  it('resolves the next cycle when referenceDate is on or after this month\'s statement day', () => {
    const window = resolveStatementWindow(15, new Date(2026, 7, 20)); // Aug 20, statementDay 15

    expect(window.cycleStart).toEqual(new Date(2026, 7, 15)); // Aug 15
    expect(window.cycleEnd).toEqual(new Date(2026, 8, 15)); // Sep 15
  });

  it('treats referenceDate equal to the statement day as the start of the new cycle', () => {
    const window = resolveStatementWindow(15, new Date(2026, 7, 15)); // exactly Aug 15

    expect(window.cycleStart).toEqual(new Date(2026, 7, 15));
    expect(window.cycleEnd).toEqual(new Date(2026, 8, 15));
  });

  it('clamps statementDay 31 to the real last day of a 30-day month', () => {
    const window = resolveStatementWindow(31, new Date(2026, 3, 5)); // Apr 5, statementDay 31

    // Previous cycle start clamps March 31 to real last day (31, March has 31 days) — fine;
    // but the cycle END must clamp April's 31 down to April 30.
    expect(window.cycleEnd).toEqual(new Date(2026, 3, 30));
  });

  it('clamps statementDay 31 to the last day of February', () => {
    const window = resolveStatementWindow(31, new Date(2026, 1, 5)); // Feb 5, statementDay 31

    expect(window.cycleStart).toEqual(new Date(2026, 0, 31)); // Jan 31
    expect(window.cycleEnd).toEqual(new Date(2026, 1, 28)); // Feb 28, 2026 (not a leap year)
  });
});
