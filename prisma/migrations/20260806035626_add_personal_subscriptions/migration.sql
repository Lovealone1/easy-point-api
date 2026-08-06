-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'AMEX', 'DINERS', 'DISCOVER', 'UNIONPAY', 'JCB', 'OTHER');

-- CreateEnum
CREATE TYPE "UserSubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BillingCycle" ADD VALUE 'WEEKLY';
ALTER TYPE "BillingCycle" ADD VALUE 'QUARTERLY';

-- CreateTable
CREATE TABLE "subscription_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_providers" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "websiteUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_payment_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "brand" "CardBrand" NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "lastFourDigits" CHAR(4),
    "statementDay" INTEGER,
    "paymentDueDay" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_payment_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT,
    "customName" TEXT,
    "customLogoUrl" TEXT,
    "customCategoryId" TEXT,
    "cardId" TEXT,
    "planLabel" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'COP',
    "billingCycle" "BillingCycle" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "nextBillingDate" TIMESTAMP(3),
    "status" "UserSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_categories_key_key" ON "subscription_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_providers_key_key" ON "subscription_providers"("key");

-- CreateIndex
CREATE INDEX "subscription_providers_categoryId_idx" ON "subscription_providers"("categoryId");

-- CreateIndex
CREATE INDEX "user_payment_cards_userId_idx" ON "user_payment_cards"("userId");

-- CreateIndex
CREATE INDEX "user_subscriptions_userId_idx" ON "user_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "user_subscriptions_userId_status_idx" ON "user_subscriptions"("userId", "status");

-- CreateIndex
CREATE INDEX "user_subscriptions_cardId_idx" ON "user_subscriptions"("cardId");

-- CreateIndex
CREATE INDEX "user_subscriptions_providerId_idx" ON "user_subscriptions"("providerId");

-- AddForeignKey
ALTER TABLE "subscription_providers" ADD CONSTRAINT "subscription_providers_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "subscription_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_payment_cards" ADD CONSTRAINT "user_payment_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "subscription_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "subscription_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "user_payment_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
