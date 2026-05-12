-- CreateEnum
CREATE TYPE "CostSource" AS ENUM ('PRODUCTION', 'ESTIMATED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "sale_utilities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "totalRevenue" DECIMAL(19,4) NOT NULL,
    "totalCost" DECIMAL(19,4) NOT NULL,
    "grossProfit" DECIMAL(19,4) NOT NULL,
    "marginPercent" DECIMAL(8,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_utilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_item_utilities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleUtilityId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitRevenue" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "totalRevenue" DECIMAL(19,4) NOT NULL,
    "totalCost" DECIMAL(19,4) NOT NULL,
    "grossProfit" DECIMAL(19,4) NOT NULL,
    "marginPercent" DECIMAL(8,4) NOT NULL,
    "costSource" "CostSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_item_utilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sale_utilities_saleId_key" ON "sale_utilities"("saleId");

-- CreateIndex
CREATE INDEX "sale_utilities_organizationId_idx" ON "sale_utilities"("organizationId");

-- CreateIndex
CREATE INDEX "sale_utilities_createdAt_idx" ON "sale_utilities"("createdAt");

-- CreateIndex
CREATE INDEX "sale_item_utilities_saleUtilityId_idx" ON "sale_item_utilities"("saleUtilityId");

-- CreateIndex
CREATE INDEX "sale_item_utilities_productId_idx" ON "sale_item_utilities"("productId");

-- CreateIndex
CREATE INDEX "sale_item_utilities_organizationId_idx" ON "sale_item_utilities"("organizationId");

-- CreateIndex
CREATE INDEX "sale_item_utilities_createdAt_idx" ON "sale_item_utilities"("createdAt");

-- AddForeignKey
ALTER TABLE "sale_utilities" ADD CONSTRAINT "sale_utilities_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_utilities" ADD CONSTRAINT "sale_utilities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item_utilities" ADD CONSTRAINT "sale_item_utilities_saleUtilityId_fkey" FOREIGN KEY ("saleUtilityId") REFERENCES "sale_utilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item_utilities" ADD CONSTRAINT "sale_item_utilities_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item_utilities" ADD CONSTRAINT "sale_item_utilities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
