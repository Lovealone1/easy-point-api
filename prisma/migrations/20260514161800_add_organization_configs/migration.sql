-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateTable
CREATE TABLE "organization_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#000000',
    "defaultTheme" "Theme" NOT NULL DEFAULT 'SYSTEM',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "language" TEXT NOT NULL DEFAULT 'es',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "taxId" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "receiptFooter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_configs_organizationId_key" ON "organization_configs"("organizationId");

-- AddForeignKey
ALTER TABLE "organization_configs" ADD CONSTRAINT "organization_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
