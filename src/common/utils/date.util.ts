/**
 * Colombian-timezone (America/Bogota, UTC-5) helpers.
 *
 * STRICTLY used for business logic, validations, and
 * display formatting.
 * 
 * WARNING: Do not use these functions to overwrite Prisma 
 * createdAt/updatedAt fields. Let Prisma use real UTC.
 */

const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5

/**
 * PRIVATE function to get an offset Date.
 * NEVER save this directly in Prisma. It is only used 
 * to safely extract the year, month, and day.
 */
function getShiftedColombiaDate(realDate: Date = new Date()): Date {
  return new Date(realDate.getTime() + COLOMBIA_OFFSET_MS);
}

/**
 * Returns today's date in Colombia as a `YYYY-MM-DD` string.
 */
export function todayColombia(): string {
  const now = getShiftedColombiaDate();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns tomorrow's date in Colombia as a `YYYY-MM-DD` string.
 */
export function tomorrowColombia(): string {
  // Add 24h to the current real date, then shift it to Colombia
  const realTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrow = getShiftedColombiaDate(realTomorrow);
  
  const y = tomorrow.getUTCFullYear();
  const m = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the start of the local day in Date format (pure UTC).
 * Excellent for Prisma queries where you need to filter "everything from today".
 * Ex: search for reservations where `createdAt >= startOfDayColombia()`
 */
export function startOfDayColombia(dateStr?: string): Date {
  const targetDate = dateStr ? new Date(dateStr) : getShiftedColombiaDate();
  const y = targetDate.getUTCFullYear();
  const m = targetDate.getUTCMonth();
  const d = targetDate.getUTCDate();
  
  // Create the date at 00:00:00 in UTC, and then REVERSE the offset
  // to get the exact UTC moment the day started in Colombia.
  const startOfLocalDayUTC = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  return new Date(startOfLocalDayUTC.getTime() - COLOMBIA_OFFSET_MS);
}

/**
 * Returns the end of the local day in Date format (pure UTC).
 * Excellent for Prisma queries where you need an upper boundary.
 * Ex: search for reservations where `createdAt <= endOfDayColombia()`
 */
export function endOfDayColombia(dateStr?: string): Date {
  const targetDate = dateStr ? new Date(dateStr) : getShiftedColombiaDate();
  const y = targetDate.getUTCFullYear();
  const m = targetDate.getUTCMonth();
  const d = targetDate.getUTCDate();
  
  // 23:59:59.999 in UTC
  const endOfLocalDayUTC = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
  return new Date(endOfLocalDayUTC.getTime() - COLOMBIA_OFFSET_MS);
}

/**
 * Checks if a `YYYY-MM-DD` string is in the past 
 * compared to the current day in Colombia.
 */
export function isDateInPastColombia(dateStr: string): boolean {
  return dateStr < todayColombia();
}

/**
 * Checks if a `YYYY-MM-DD` string is tomorrow or later
 * compared to the current day in Colombia.
 */
export function isDateTomorrowOrLaterColombia(dateStr: string): boolean {
  return dateStr >= tomorrowColombia();
}

