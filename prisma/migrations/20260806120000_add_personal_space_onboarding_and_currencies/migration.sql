-- CreateEnum
CREATE TYPE "OnboardingGoal" AS ENUM ('SAVE_MONEY', 'TRACK_SPENDING', 'MANAGE_FAMILY', 'NEVER_MISS_RENEWAL');

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('GOAL', 'REGION', 'REMINDERS', 'DONE');

-- CreateEnum
CREATE TYPE "RecurrenceUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'QUARTER', 'SEMESTER', 'YEAR');

-- CreateTable
CREATE TABLE "currencies" (
    "code" CHAR(3) NOT NULL,
    "numericCode" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,
    "symbol" TEXT,
    "decimalDigits" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goal" "OnboardingGoal",
    "timezone" TEXT NOT NULL DEFAULT 'America/Bogota',
    "preferredCurrency" CHAR(3) NOT NULL DEFAULT 'COP',
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "renewalReminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "reminderChannels" JSONB,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "onboardingStep" "OnboardingStep" NOT NULL DEFAULT 'GOAL',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate_snapshots" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseCurrency" CHAR(3) NOT NULL,
    "rates" JSONB NOT NULL,
    "ratesAsOf" TIMESTAMP(3) NOT NULL,
    "nextUpdateAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "currencies_isActive_isPopular_sortOrder_idx" ON "currencies"("isActive", "isPopular", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "exchange_rate_snapshots_baseCurrency_idx" ON "exchange_rate_snapshots"("baseCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_snapshots_provider_baseCurrency_key" ON "exchange_rate_snapshots"("provider", "baseCurrency");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Range guards. Prisma cannot model CHECK constraints, so these live only in
-- the database and mirror the class-validator rules on the DTOs.
ALTER TABLE "user_preferences"
  ADD CONSTRAINT "user_preferences_renewalReminderDaysBefore_check"
    CHECK ("renewalReminderDaysBefore" >= 0 AND "renewalReminderDaysBefore" <= 90),
  ADD CONSTRAINT "user_preferences_quietHoursStart_check"
    CHECK ("quietHoursStart" IS NULL OR ("quietHoursStart" >= 0 AND "quietHoursStart" <= 23)),
  ADD CONSTRAINT "user_preferences_quietHoursEnd_check"
    CHECK ("quietHoursEnd" IS NULL OR ("quietHoursEnd" >= 0 AND "quietHoursEnd" <= 23));
