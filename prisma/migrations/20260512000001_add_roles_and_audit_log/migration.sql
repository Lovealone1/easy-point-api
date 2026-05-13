-- Migration: add_roles_and_audit_log
-- Adds the dynamic roles/permissions system and the append-only audit log table.
-- These changes were previously applied via `prisma db push` and are now
-- formalised as a tracked migration for cross-device replication.

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLES & PERMISSIONS SYSTEM
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old Role enum (replaced by dynamic roles table)
ALTER TABLE "organization_users" DROP COLUMN IF EXISTS "role";
ALTER TABLE "invitations" DROP COLUMN IF EXISTS "role";

DROP TYPE IF EXISTS "Role";

-- Modules catalogue
CREATE TABLE IF NOT EXISTS "modules" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "modules_name_key" ON "modules"("name");

-- Permissions catalogue
CREATE TABLE IF NOT EXISTS "permissions" (
    "id"          TEXT NOT NULL,
    "resource"    TEXT NOT NULL,
    "action"      TEXT NOT NULL,
    "description" TEXT,
    "moduleId"    TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_resource_action_key" ON "permissions"("resource", "action");

-- Roles (per-organization custom roles)
CREATE TABLE IF NOT EXISTS "roles" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "displayName"    TEXT NOT NULL,
    "description"    TEXT,
    "organizationId" TEXT,
    "isDefault"      BOOLEAN NOT NULL DEFAULT false,
    "isSystem"       BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "roles_organizationId_name_key" ON "roles"("organizationId", "name");

-- Role ↔ Permission assignments (supports both global and per-org roles)
CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id"             TEXT NOT NULL,
    "globalRole"     TEXT,
    "roleId"         TEXT,
    "permissionId"   TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_roleId_permissionId_key"
    ON "role_permissions"("roleId", "permissionId");
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_globalRole_permissionId_key"
    ON "role_permissions"("globalRole", "permissionId");

-- Add roleId FK column to existing tables
ALTER TABLE "organization_users"
    ADD COLUMN IF NOT EXISTS "roleId" TEXT;

ALTER TABLE "invitations"
    ADD COLUMN IF NOT EXISTS "roleId" TEXT;

-- Foreign keys
ALTER TABLE "roles"
    ADD CONSTRAINT "roles_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permissions"
    ADD CONSTRAINT "permissions_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "modules"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "permissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_users"
    ADD CONSTRAINT "organization_users_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invitations"
    ADD CONSTRAINT "invitations_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT LOG — Append-only compliance & traceability store
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS "AuditAction" AS ENUM (
    'CREATE', 'UPDATE', 'DELETE', 'RESTORE',
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'PASSWORD_CHANGE', 'ROLE_CHANGE', 'PERMISSION_CHANGE',
    'EXPORT', 'CANCEL', 'API_KEY_CHANGE',
    'TENANT_CONFIG_CHANGE', 'SESSION_KILL', 'CUSTOM'
);

CREATE TYPE IF NOT EXISTS "AuditSeverity" AS ENUM (
    'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
);

-- Audit log table — NEVER UPDATE OR DELETE ROWS from application code
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "userId"         TEXT,
    "impersonatedBy" TEXT,
    "action"         "AuditAction" NOT NULL,
    "resourceType"   TEXT NOT NULL,
    "resourceId"     TEXT,
    "before"         JSONB,
    "after"          JSONB,
    "changedFields"  JSONB,
    "metadata"       JSONB,
    "ipAddress"      TEXT,
    "userAgent"      TEXT,
    "requestId"      TEXT,
    "sessionId"      TEXT,
    "severity"       "AuditSeverity" NOT NULL DEFAULT 'LOW',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Indices for common query patterns
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_idx"
    ON "audit_logs"("tenantId");
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_userId_idx"
    ON "audit_logs"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_resourceType_resourceId_idx"
    ON "audit_logs"("tenantId", "resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_action_idx"
    ON "audit_logs"("tenantId", "action");
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_severity_idx"
    ON "audit_logs"("tenantId", "severity");
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_createdAt_idx"
    ON "audit_logs"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx"
    ON "audit_logs"("createdAt");
