-- Stores a completed import so retries are safe and auditable.
CREATE TABLE "import_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "resource" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "totalRows" INTEGER NOT NULL,
    "createdRows" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_records_organizationId_resource_idempotencyKey_key"
  ON "import_records"("organizationId", "resource", "idempotencyKey");
CREATE INDEX "import_records_organizationId_resource_createdAt_idx"
  ON "import_records"("organizationId", "resource", "createdAt");
