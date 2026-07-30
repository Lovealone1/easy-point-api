import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  organizationId: string | null;
  // We can add bypass rules, UserRoles or GlobalRoles here if necessary
  bypassTenant?: boolean;

  /**
   * True while running inside a transaction that has already published the
   * tenant to Postgres (`app.current_org_id`) for RLS. Prevents the Prisma
   * extension from recursively opening another transaction per query.
   */
  gucApplied?: boolean;

  // ── Audit context ─────────────────────────────────────────────────────────
  // Populated by RequestContextMiddleware (pre-guard) and lazily by AuditService
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  impersonatedBy?: string; // Reserved for future impersonation feature
}

export interface AuditContext {
  organizationId: string | null;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  impersonatedBy?: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

export function getTenantId(): string | null {
  const store = getTenantContext();
  return store?.organizationId || null;
}

/**
 * Returns a snapshot of the current audit context from AsyncLocalStorage.
 * Safe to call from any service without injecting HTTP request objects.
 */
export function getAuditContext(): AuditContext {
  const store = getTenantContext();
  return {
    organizationId: store?.organizationId ?? null,
    requestId: store?.requestId,
    userId: store?.userId,
    sessionId: store?.sessionId,
    ipAddress: store?.ipAddress,
    userAgent: store?.userAgent,
    impersonatedBy: store?.impersonatedBy,
  };
}

/**
 * Mutates the current AsyncLocalStorage store to patch audit fields.
 * Called lazily by AuditService after JWT has been validated.
 */
export function patchAuditContext(patch: Partial<TenantContext>): void {
  const store = getTenantContext();
  if (!store) return;
  Object.assign(store, patch);
}

/**
 * Runs `fn` in a context that is explicitly allowed to cross tenant
 * boundaries, disabling the automatic organizationId scoping applied by the
 * Prisma extension.
 *
 * This is for trusted server-side flows only — cron jobs, organization
 * bootstrapping, global-admin reads. It is NOT reachable from an HTTP header:
 * `x-bypass-tenant` is gated on GlobalRole.ADMIN in TenantMiddleware and is a
 * separate path from this one.
 */
/**
 * Marks the current context as having already published the tenant to Postgres,
 * so the Prisma extension does not open a nested transaction for each query
 * issued inside an existing tenant/system transaction.
 */
export function runWithGucApplied<T>(fn: () => T): T {
  const current = getTenantContext();

  return tenantContextStorage.run(
    { ...(current ?? { organizationId: null }), gucApplied: true },
    fn,
  );
}

export function runAsSystem<T>(fn: () => T): T {
  const current = getTenantContext();

  return tenantContextStorage.run(
    { ...(current ?? { organizationId: null }), bypassTenant: true },
    fn,
  );
}
