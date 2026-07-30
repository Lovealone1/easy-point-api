import {
  tenantContextStorage,
  getTenantContext,
  getTenantId,
  runAsSystem,
  runWithGucApplied,
} from './tenant.context';

describe('tenant context', () => {
  const withTenant = <T>(organizationId: string | null, fn: () => T): T =>
    tenantContextStorage.run({ organizationId }, fn);

  describe('runAsSystem', () => {
    it('marks the context as cross-tenant', () => {
      withTenant('org-1', () => {
        expect(getTenantContext()?.bypassTenant).toBeUndefined();

        runAsSystem(() => {
          expect(getTenantContext()?.bypassTenant).toBe(true);
        });
      });
    });

    it('preserves the surrounding organizationId', () => {
      withTenant('org-1', () => {
        runAsSystem(() => {
          expect(getTenantId()).toBe('org-1');
        });
      });
    });

    it('does not leak the bypass to the surrounding context', () => {
      withTenant('org-1', () => {
        runAsSystem(() => undefined);
        expect(getTenantContext()?.bypassTenant).toBeUndefined();
      });
    });

    it('works with no ambient context (cron / bootstrap)', () => {
      expect(getTenantContext()).toBeUndefined();

      runAsSystem(() => {
        expect(getTenantContext()?.bypassTenant).toBe(true);
        expect(getTenantId()).toBeNull();
      });
    });
  });

  describe('runWithGucApplied', () => {
    it('flags that the tenant is already published to Postgres', () => {
      withTenant('org-1', () => {
        expect(getTenantContext()?.gucApplied).toBeUndefined();

        runWithGucApplied(() => {
          expect(getTenantContext()?.gucApplied).toBe(true);
          expect(getTenantId()).toBe('org-1');
        });
      });
    });

    it('does not leak the flag outward', () => {
      withTenant('org-1', () => {
        runWithGucApplied(() => undefined);
        expect(getTenantContext()?.gucApplied).toBeUndefined();
      });
    });

    it('survives async boundaries inside the callback', async () => {
      await withTenant('org-1', async () => {
        await runWithGucApplied(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          // If this were lost across the await, the Prisma extension would open
          // a nested transaction per query inside an existing transaction.
          expect(getTenantContext()?.gucApplied).toBe(true);
          expect(getTenantId()).toBe('org-1');
        });
      });
    });
  });

  describe('isolation between concurrent requests', () => {
    it('keeps separate tenants separate across interleaved async work', async () => {
      const seen: string[] = [];

      const request = async (org: string, delay: number) =>
        withTenant(org, async () => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          seen.push(`${org}:${getTenantId()}`);
        });

      await Promise.all([request('org-a', 5), request('org-b', 1)]);

      // Each async chain must observe only its own tenant, regardless of the
      // order in which they resume.
      expect(seen.sort()).toEqual(['org-a:org-a', 'org-b:org-b']);
    });
  });
});
