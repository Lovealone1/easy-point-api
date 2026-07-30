-- Routing seam for future per-tenant database separation.
-- Every existing organization stays on the shared "default" database; this
-- column exists so a specific tenant can later be pinned to a dedicated
-- database without an application rewrite. Resolved by DatabaseRegistryService.

ALTER TABLE "organizations" ADD COLUMN "databaseId" TEXT NOT NULL DEFAULT 'default';

CREATE INDEX "organizations_databaseId_idx" ON "organizations"("databaseId");
