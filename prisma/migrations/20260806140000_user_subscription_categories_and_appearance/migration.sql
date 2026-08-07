-- ─────────────────────────────────────────────────────────────────────────────
-- User-authored subscription categories + personal-space appearance settings.
-- ─────────────────────────────────────────────────────────────────────────────

-- AlterTable: categories become ownable. NULL userId = seeded system category.
ALTER TABLE "subscription_categories" ADD COLUMN "userId" TEXT;

-- The old global unique on `key` has to go: two different users must be able to
-- name a category the same thing.
DROP INDEX IF EXISTS "subscription_categories_key_key";

-- CreateIndex
CREATE UNIQUE INDEX "subscription_categories_userId_key_key"
  ON "subscription_categories"("userId", "key");

-- Postgres treats NULLs as distinct, so the compound unique above would happily
-- accept two (NULL, 'entertainment') rows. This partial index is what actually
-- keeps system category keys unique. Prisma cannot express partial indexes, so
-- it exists only here — do not expect `prisma migrate diff` to know about it.
CREATE UNIQUE INDEX "subscription_categories_system_key_key"
  ON "subscription_categories"("key") WHERE "userId" IS NULL;

-- CreateIndex
CREATE INDEX "subscription_categories_userId_idx" ON "subscription_categories"("userId");

-- AddForeignKey
ALTER TABLE "subscription_categories"
  ADD CONSTRAINT "subscription_categories_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: personal-space appearance, mirroring OrganizationConfig branding.
ALTER TABLE "user_preferences"
  ADD COLUMN "primaryColor" TEXT,
  ADD COLUMN "defaultTheme" "Theme" NOT NULL DEFAULT 'SYSTEM';
