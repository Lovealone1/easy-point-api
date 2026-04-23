import { CronExpression } from '@nestjs/schedule';

/**
 * Domain-specific custom Cron expressions that are not in NestJS CronExpression.
 */
export const CustomCronExpression = {
  EVERY_15_DAYS: '0 0 1,15 * *', // 1st and 15th of the month at midnight
  END_OF_MONTH: '59 23 28-31 * *', // Requires additional logic to validate if it's the last day
  EVERY_WORKDAY_AT_8AM: '0 8 * * 1-5', // Monday to Friday at 8 AM
} as const;

/**
 * Utilities for handling and validating job timings.
 */
export class CronUtils {
  /**
   * Verifies if the current date is the last day of the month.
   * Useful for daily jobs that should only trigger at the end of the month.
   */
  static isLastDayOfMonth(date: Date = new Date()): boolean {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.getDate() === 1;
  }
}
