-- CreateEnum
CREATE TYPE "ProductionType" AS ENUM ('SELLABLE', 'INTERMEDIATE');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "productionId" TEXT;

-- AlterTable
ALTER TABLE "supply_movements" ADD COLUMN     "productionId" TEXT;

-- CreateTable
CREATE TABLE "supply_stock_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplyStockId" TEXT NOT NULL,
    "supplyPurchaseId" TEXT,
    "initialQuantity" DECIMAL(12,4) NOT NULL,
    "remainingQuantity" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "isExhausted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_stock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productionDate" TIMESTAMP(3) NOT NULL,
    "type" "ProductionType" NOT NULL DEFAULT 'SELLABLE',
    "status" "ProductionStatus" NOT NULL DEFAULT 'DRAFT',
    "productId" TEXT,
    "quantityProduced" DECIMAL(12,4) NOT NULL,
    "unitOfMeasure" "UnitOfMeasure" NOT NULL,
    "totalCost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "performedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_supply_usages" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "supplyStockEntryId" TEXT,
    "quantityUsed" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "totalCost" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_supply_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supply_stock_entries_supplyStockId_idx" ON "supply_stock_entries"("supplyStockId");

-- CreateIndex
CREATE INDEX "supply_stock_entries_organizationId_idx" ON "supply_stock_entries"("organizationId");

-- CreateIndex
CREATE INDEX "supply_stock_entries_isExhausted_idx" ON "supply_stock_entries"("isExhausted");

-- CreateIndex
CREATE INDEX "productions_organizationId_idx" ON "productions"("organizationId");

-- CreateIndex
CREATE INDEX "productions_productId_idx" ON "productions"("productId");

-- CreateIndex
CREATE INDEX "productions_productionDate_idx" ON "productions"("productionDate");

-- CreateIndex
CREATE INDEX "productions_status_idx" ON "productions"("status");

-- CreateIndex
CREATE INDEX "production_supply_usages_productionId_idx" ON "production_supply_usages"("productionId");

-- CreateIndex
CREATE INDEX "production_supply_usages_supplyId_idx" ON "production_supply_usages"("supplyId");

-- CreateIndex
CREATE INDEX "production_supply_usages_supplyStockEntryId_idx" ON "production_supply_usages"("supplyStockEntryId");

-- CreateIndex
CREATE INDEX "inventory_movements_productionId_idx" ON "inventory_movements"("productionId");

-- CreateIndex
CREATE INDEX "supply_movements_productionId_idx" ON "supply_movements"("productionId");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "productions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_movements" ADD CONSTRAINT "supply_movements_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "productions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stock_entries" ADD CONSTRAINT "supply_stock_entries_supplyStockId_fkey" FOREIGN KEY ("supplyStockId") REFERENCES "supply_stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stock_entries" ADD CONSTRAINT "supply_stock_entries_supplyPurchaseId_fkey" FOREIGN KEY ("supplyPurchaseId") REFERENCES "supply_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_stock_entries" ADD CONSTRAINT "supply_stock_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_supply_usages" ADD CONSTRAINT "production_supply_usages_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_supply_usages" ADD CONSTRAINT "production_supply_usages_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_supply_usages" ADD CONSTRAINT "production_supply_usages_supplyStockEntryId_fkey" FOREIGN KEY ("supplyStockEntryId") REFERENCES "supply_stock_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
