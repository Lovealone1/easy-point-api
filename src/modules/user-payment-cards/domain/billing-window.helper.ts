/** Clamps a nominal day-of-month (e.g. 31) to the last real day of that month. */
function clampToMonth(year: number, month: number, day: number): Date {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDayOfMonth));
}

export interface StatementWindow {
  cycleStart: Date;
  cycleEnd: Date;
}

/**
 * Resolves a card's current billing cycle — the window between the most
 * recent statement date on/before referenceDate and the next one after it.
 * statementDay is clamped to the real last day of shorter months (31 in
 * February becomes 28/29).
 */
export function resolveStatementWindow(statementDay: number, referenceDate: Date): StatementWindow {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  const thisMonthStatement = clampToMonth(year, month, statementDay);

  let cycleStart: Date;
  let cycleEnd: Date;

  if (referenceDate >= thisMonthStatement) {
    cycleStart = thisMonthStatement;
    cycleEnd = clampToMonth(year, month + 1, statementDay);
  } else {
    cycleStart = clampToMonth(year, month - 1, statementDay);
    cycleEnd = thisMonthStatement;
  }

  return { cycleStart, cycleEnd };
}
