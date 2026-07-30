-- Row-Level Security: Postgres enforces tenant isolation, not the application.
--
-- The application connects as `easypoint_app`, which is NOT the table owner and
-- does NOT have BYPASSRLS. Migrations keep running as the owner via DIRECT_URL,
-- which is intentionally exempt from these policies.
--
-- Tenant is published per-transaction via set_config(...,TRUE) — see
-- PrismaService.$tenantTransaction. current_setting(...,TRUE) returns NULL when
-- unset, so an unscoped query matches ZERO rows: this fails closed by design.

-- ── Application role ──────────────────────────────────────────────────────
-- Created WITHOUT a password on purpose: secrets must not live in a migration
-- committed to git. A LOGIN role with no password cannot authenticate under
-- scram/md5, so this fails closed until the operator runs, once per environment:
--
--   ALTER ROLE easypoint_app WITH PASSWORD '<POSTGRES_APP_PASSWORD>';
--
-- See docs/DEPLOYMENT.md ("Rol de aplicación para RLS").
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'easypoint_app') THEN
    CREATE ROLE easypoint_app LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO easypoint_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO easypoint_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO easypoint_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO easypoint_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO easypoint_app;

-- ── Tenant isolation policies ─────────────────────────────────────────────

ALTER TABLE "organization_users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "organization_users";
CREATE POLICY tenant_isolation ON "organization_users"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "organization_configs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "organization_configs";
CREATE POLICY tenant_isolation ON "organization_configs"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "clients";
CREATE POLICY tenant_isolation ON "clients"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "suppliers";
CREATE POLICY tenant_isolation ON "suppliers"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "employees";
CREATE POLICY tenant_isolation ON "employees"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "supplies" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "supplies";
CREATE POLICY tenant_isolation ON "supplies"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "product_categories" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "product_categories";
CREATE POLICY tenant_isolation ON "product_categories"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "products";
CREATE POLICY tenant_isolation ON "products"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "recipes";
CREATE POLICY tenant_isolation ON "recipes"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "product_stocks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "product_stocks";
CREATE POLICY tenant_isolation ON "product_stocks"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "inventory_movements";
CREATE POLICY tenant_isolation ON "inventory_movements"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "supply_stocks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "supply_stocks";
CREATE POLICY tenant_isolation ON "supply_stocks"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "supply_movements" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "supply_movements";
CREATE POLICY tenant_isolation ON "supply_movements"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "bank_accounts";
CREATE POLICY tenant_isolation ON "bank_accounts"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "financial_transactions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "financial_transactions";
CREATE POLICY tenant_isolation ON "financial_transactions"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "supply_purchases" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "supply_purchases";
CREATE POLICY tenant_isolation ON "supply_purchases"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "product_purchases" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "product_purchases";
CREATE POLICY tenant_isolation ON "product_purchases"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "sales";
CREATE POLICY tenant_isolation ON "sales"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "sale_utilities" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "sale_utilities";
CREATE POLICY tenant_isolation ON "sale_utilities"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "sale_item_utilities" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "sale_item_utilities";
CREATE POLICY tenant_isolation ON "sale_item_utilities"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "transaction_categories" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "transaction_categories";
CREATE POLICY tenant_isolation ON "transaction_categories"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "supply_stock_entries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "supply_stock_entries";
CREATE POLICY tenant_isolation ON "supply_stock_entries"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "productions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "productions";
CREATE POLICY tenant_isolation ON "productions"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "roles";
CREATE POLICY tenant_isolation ON "roles"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "role_permissions";
CREATE POLICY tenant_isolation ON "role_permissions"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "discount_rules" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "discount_rules";
CREATE POLICY tenant_isolation ON "discount_rules"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "applied_discounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "applied_discounts";
CREATE POLICY tenant_isolation ON "applied_discounts"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "expense_categories" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "expense_categories";
CREATE POLICY tenant_isolation ON "expense_categories"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );

ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "expenses";
CREATE POLICY tenant_isolation ON "expenses"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  );
