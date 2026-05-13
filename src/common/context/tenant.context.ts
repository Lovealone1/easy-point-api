import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  organizationId: string | null;
  // We can add bypass rules, UserRoles or GlobalRoles here if necessary
  bypassTenant?: boolean;

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
