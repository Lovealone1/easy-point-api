-- AlterTable
-- billingCycle keeps its column but stops being written; recurrenceUnit +
-- recurrenceInterval supersede it. It gains a default so inserts that omit it
-- (i.e. all of them from now on) still succeed. The column is dropped in a
-- follow-up migration once the frontend rollout has settled.
ALTER TABLE "user_subscriptions" ALTER COLUMN "billingCycle" SET DEFAULT 'MONTHLY';

ALTER TABLE "user_subscriptions"
  ADD COLUMN "recurrenceUnit" "RecurrenceUnit" NOT NULL DEFAULT 'MONTH',
  ADD COLUMN "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "customWebsiteUrl" TEXT,
  ADD COLUMN "billingCutoffDay" INTEGER;

-- Backfill the new recurrence fields from the deprecated billingCycle so
-- existing rows keep their schedule. Every legacy cycle maps to interval 1.
UPDATE "user_subscriptions" SET
  "recurrenceUnit" = CASE "billingCycle"
    WHEN 'WEEKLY'    THEN 'WEEK'
    WHEN 'MONTHLY'   THEN 'MONTH'
    WHEN 'QUARTERLY' THEN 'QUARTER'
    WHEN 'YEARLY'    THEN 'YEAR'
    ELSE 'MONTH'
  END::"RecurrenceUnit",
  "recurrenceInterval" = 1;

-- Range guards, mirroring the class-validator rules on the DTOs.
ALTER TABLE "user_subscriptions"
  ADD CONSTRAINT "user_subscriptions_recurrenceInterval_check"
    CHECK ("recurrenceInterval" >= 1 AND "recurrenceInterval" <= 365),
  ADD CONSTRAINT "user_subscriptions_billingCutoffDay_check"
    CHECK ("billingCutoffDay" IS NULL OR ("billingCutoffDay" >= 1 AND "billingCutoffDay" <= 31));
