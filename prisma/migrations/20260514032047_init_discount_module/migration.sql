-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('GLOBAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "DiscountCategory" AS ENUM ('ONE_TIME', 'PERIODIC');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "discountAmount" DECIMAL(19,4),
ADD COLUMN     "subtotalAmount" DECIMAL(19,4);

-- CreateTable
CREATE TABLE "discount_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "scope" "DiscountScope" NOT NULL,
    "clientId" TEXT,
    "category" "DiscountCategory" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "maxDiscountAmount" DECIMAL(19,4),
    "minSaleAmount" DECIMAL(19,4),
    "maxUsages" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applied_discounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "discountRuleId" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(12,4) NOT NULL,
    "discountAmount" DECIMAL(19,4) NOT NULL,
    "originalAmount" DECIMAL(19,4) NOT NULL,
    "finalAmount" DECIMAL(19,4) NOT NULL,
    "reason" TEXT,
    "appliedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applied_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discount_rules_organizationId_idx" ON "discount_rules"("organizationId");

-- CreateIndex
CREATE INDEX "discount_rules_clientId_idx" ON "discount_rules"("clientId");

-- CreateIndex
CREATE INDEX "discount_rules_category_idx" ON "discount_rules"("category");

-- CreateIndex
CREATE INDEX "discount_rules_isActive_idx" ON "discount_rules"("isActive");

-- CreateIndex
CREATE INDEX "discount_rules_expiresAt_idx" ON "discount_rules"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "discount_rules_organizationId_code_key" ON "discount_rules"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "applied_discounts_saleId_key" ON "applied_discounts"("saleId");

-- CreateIndex
CREATE INDEX "applied_discounts_organizationId_idx" ON "applied_discounts"("organizationId");

-- CreateIndex
CREATE INDEX "applied_discounts_discountRuleId_idx" ON "applied_discounts"("discountRuleId");

-- CreateIndex
CREATE INDEX "applied_discounts_createdAt_idx" ON "applied_discounts"("createdAt");

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_discounts" ADD CONSTRAINT "applied_discounts_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_discounts" ADD CONSTRAINT "applied_discounts_discountRuleId_fkey" FOREIGN KEY ("discountRuleId") REFERENCES "discount_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_discounts" ADD CONSTRAINT "applied_discounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_discounts" ADD CONSTRAINT "applied_discounts_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
