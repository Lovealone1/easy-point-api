-- CreateTable
CREATE TABLE "organization_modules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_modules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_modules_organizationId_idx" ON "organization_modules"("organizationId");

-- CreateIndex
CREATE INDEX "organization_modules_moduleId_idx" ON "organization_modules"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_modules_organizationId_moduleId_key" ON "organization_modules"("organizationId", "moduleId");

-- AddForeignKey
ALTER TABLE "organization_modules" ADD CONSTRAINT "organization_modules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_modules" ADD CONSTRAINT "organization_modules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
