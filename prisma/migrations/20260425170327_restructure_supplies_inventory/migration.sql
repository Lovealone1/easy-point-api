/*
  Warnings:

  - You are about to drop the column `quantityInStock` on the `supplies` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SupplyMovementType" AS ENUM ('PURCHASE', 'PRODUCTION', 'ADJUSTMENT', 'WASTE', 'TESTS');

-- AlterTable
ALTER TABLE "supplies" DROP COLUMN "quantityInStock";

-- CreateTable
CREATE TABLE "supply_stocks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Principal',
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "minQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_movements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4),
    "type" "SupplyMovementType" NOT NULL,
    "reason" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "performedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supply_stocks_organizationId_idx" ON "supply_stocks"("organizationId");

-- CreateIndex
CREATE INDEX "supply_stocks_supplyId_idx" ON "supply_stocks"("supplyId");

-- CreateIndex
CREATE UNIQUE INDEX "supply_stocks_supplyId_location_key" ON "supply_stocks"("supplyId", "location");

-- CreateIndex
CREATE INDEX "supply_movements_organizationId_idx" ON "supply_movements"("organizationId");

-- CreateIndex
CREATE INDEX "supply_movements_supplyId_idx" ON "supply_movements"("supplyId");

-- CreateIndex
CREATE INDEX "supply_movements_stockId_idx" ON "supply_movements"("stockId");

-- CreateIndex
CREATE INDEX "supply_movements_type_idx" ON "supply_movements"("type");

-- CreateIndex
CREATE INDEX "supply_movements_createdAt_idx" ON "supply_movements"("createdAt");

-- AddForeignKey
ALTER TABLE "supply_stocks" ADD CONSTRAINT "supply_stocks_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stocks" ADD CONSTRAINT "supply_stocks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_movements" ADD CONSTRAINT "supply_movements_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_movements" ADD CONSTRAINT "supply_movements_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "supply_stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_movements" ADD CONSTRAINT "supply_movements_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_movements" ADD CONSTRAINT "supply_movements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
