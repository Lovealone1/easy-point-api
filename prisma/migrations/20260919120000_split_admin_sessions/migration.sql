-- Splits the tenant dashboard and the administration console into two
-- independent sessions. Refresh tokens are pinned to the application they
-- were issued for, so a console token can never be redeemed for a dashboard
-- session (or the other way round).
--
-- Existing rows predate the split and all belong to the dashboard, hence the
-- TENANT default. They are revoked on deploy regardless: the Redis session
-- keys are re-namespaced in the same release, so every live session has to
-- sign in once more.

CREATE TYPE "SessionScope" AS ENUM ('TENANT', 'ADMIN');

ALTER TABLE "refresh_tokens"
  ADD COLUMN "scope" "SessionScope" NOT NULL DEFAULT 'TENANT';

CREATE INDEX "refresh_tokens_userId_scope_idx" ON "refresh_tokens"("userId", "scope");
