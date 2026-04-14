/**
 * Colombian-timezone (America/Bogota, UTC-5) helpers.
 *
 * Utilizados ESTRICTAMENTE para lógica de negocio, validaciones y
 * formateo de display.
 * 
 * ATENCIÓN: No usar estas funciones para sobreescribir los 
 * campos createdAt/updatedAt de Prisma. Deja que Prisma use UTC real.
 */

const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5

/**
 * Función PRIVADA para obtener un Date desplazado.
 * NUNCA debe guardarse directamente en Prisma, solo sirve 
 * para extraer año, mes y día de forma segura.
 */
function getShiftedColombiaDate(realDate: Date = new Date()): Date {
  return new Date(realDate.getTime() + COLOMBIA_OFFSET_MS);
}

/**
 * Retorna la fecha de hoy en Colombia como un string `YYYY-MM-DD`.
 */
export function todayColombia(): string {
  const now = getShiftedColombiaDate();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna la fecha de mañana en Colombia como un string `YYYY-MM-DD`.
 */
export function tomorrowColombia(): string {
  // Sumamos 24h a la fecha actual real, y luego la desplazamos a Colombia
  const realTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrow = getShiftedColombiaDate(realTomorrow);
  
  const y = tomorrow.getUTCFullYear();
  const m = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna el inicio del día local en formato Date (UTC puro).
 * Excelente para queries de Prisma donde necesites filtrar "todo lo de hoy".
 * Ej: buscar reservas donde `createdAt >= startOfDayColombia()`
 */
export function startOfDayColombia(dateStr?: string): Date {
  const targetDate = dateStr ? new Date(dateStr) : getShiftedColombiaDate();
  const y = targetDate.getUTCFullYear();
  const m = targetDate.getUTCMonth();
  const d = targetDate.getUTCDate();
  
  // Creamos la fecha a las 00:00:00 en UTC, y luego REVERTIMOS el offset
  // para obtener el momento UTC exacto en el que empezó el día en Colombia.
  const startOfLocalDayUTC = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  return new Date(startOfLocalDayUTC.getTime() - COLOMBIA_OFFSET_MS);
}

/**
 * Retorna el fin del día local en formato Date (UTC puro).
 * Excelente para queries de Prisma donde necesites un límite superior.
 * Ej: buscar reservas donde `createdAt <= endOfDayColombia()`
 */
export function endOfDayColombia(dateStr?: string): Date {
  const targetDate = dateStr ? new Date(dateStr) : getShiftedColombiaDate();
  const y = targetDate.getUTCFullYear();
  const m = targetDate.getUTCMonth();
  const d = targetDate.getUTCDate();
  
  // 23:59:59.999 en UTC
  const endOfLocalDayUTC = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
  return new Date(endOfLocalDayUTC.getTime() - COLOMBIA_OFFSET_MS);
}

/**
 * Verifica si un string `YYYY-MM-DD` pertenece al pasado 
 * respecto al día actual en Colombia.
 */
export function isDateInPastColombia(dateStr: string): boolean {
  return dateStr < todayColombia();
}

/**
 * Verifica si un string `YYYY-MM-DD` es el día de mañana o después
 * respecto al día actual en Colombia.
 */
export function isDateTomorrowOrLaterColombia(dateStr: string): boolean {
  return dateStr >= tomorrowColombia();
}
