import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  organizationId: string | null;
  // We can add bypass rules, UserRoles or GlobalRoles here if necessary
  bypassTenant?: boolean; 
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

export function getTenantId(): string | null {
  const store = getTenantContext();
  return store?.organizationId || null;
}
