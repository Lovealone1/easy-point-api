import * as fs from 'fs';
import * as path from 'path';
import { TENANT_AWARE_MODELS, TENANT_EXEMPT_MODELS } from './tenant-models';

/**
 * Guards the multi-tenant boundary against drift.
 *
 * Adding a model with an `organizationId` and forgetting to wire it into the
 * tenant scoping (ORM) and the RLS policies (database) is a silent cross-tenant
 * data leak. These tests make that mistake fail CI instead of production.
 */
describe('multi-tenant model coverage', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const schema = fs.readFileSync(
    path.join(projectRoot, 'prisma/schema.prisma'),
    'utf8',
  );

  /** Every model declaring an organizationId, with its mapped table name. */
  const orgScopedModels: { model: string; table: string }[] = schema
    .split(/\nmodel /)
    .slice(1)
    .map((block) => {
      const model = block.split(/[\s{]/)[0];
      const body = block.slice(0, block.indexOf('\n}'));
      const mapped = body.match(/@@map\("([^"]+)"\)/);
      return {
        model,
        table: mapped ? mapped[1] : model,
        hasOrgId: /\borganizationId\b/.test(body),
      };
    })
    .filter((m) => m.hasOrgId)
    .map(({ model, table }) => ({ model, table }));

  it('finds org-scoped models in the schema (sanity check on the parser)', () => {
    expect(orgScopedModels.length).toBeGreaterThan(25);
    expect(orgScopedModels.map((m) => m.model)).toContain('Sale');
  });

  it('classifies every org-scoped model as either tenant-aware or explicitly exempt', () => {
    const unclassified = orgScopedModels
      .map((m) => m.model)
      .filter(
        (model) =>
          !TENANT_AWARE_MODELS.has(model) && !TENANT_EXEMPT_MODELS.has(model),
      );

    expect(unclassified).toEqual([]);
  });

  it('does not list models that no longer carry an organizationId', () => {
    const schemaModels = new Set(orgScopedModels.map((m) => m.model));
    const stale = [...TENANT_AWARE_MODELS, ...TENANT_EXEMPT_MODELS].filter(
      (model) => !schemaModels.has(model),
    );

    expect(stale).toEqual([]);
  });

  describe('RLS policies', () => {
    const migrationsDir = path.join(projectRoot, 'prisma/migrations');
    const rlsMigrationDir = fs
      .readdirSync(migrationsDir)
      .find((dir) => dir.endsWith('_enable_rls'));

    const rlsSql = fs.readFileSync(
      path.join(migrationsDir, rlsMigrationDir!, 'migration.sql'),
      'utf8',
    );

    it('has an RLS migration', () => {
      expect(rlsMigrationDir).toBeDefined();
    });

    it('enables RLS and defines a policy for every tenant-aware table', () => {
      const missing = orgScopedModels
        .filter((m) => TENANT_AWARE_MODELS.has(m.model))
        .filter(
          (m) =>
            !rlsSql.includes(`ALTER TABLE "${m.table}" ENABLE ROW LEVEL SECURITY`) ||
            !rlsSql.includes(`CREATE POLICY tenant_isolation ON "${m.table}"`),
        )
        .map((m) => m.table);

      expect(missing).toEqual([]);
    });

    it('does not apply RLS to the deliberately exempt tables', () => {
      const wronglyIncluded = orgScopedModels
        .filter((m) => TENANT_EXEMPT_MODELS.has(m.model))
        .filter((m) => rlsSql.includes(`ALTER TABLE "${m.table}" ENABLE ROW LEVEL SECURITY`))
        .map((m) => m.table);

      expect(wronglyIncluded).toEqual([]);
    });

    it('scopes policies to a transaction-local setting, never a session-wide one', () => {
      // A plain `SET` would persist on the pooled connection and leak the
      // tenant into the next request that reuses it.
      expect(rlsSql).toContain("current_setting('app.current_org_id', TRUE)");
      expect(rlsSql).not.toMatch(/^\s*SET\s+app\.current_org_id/m);
    });

    it('grants the application role no ability to bypass RLS', () => {
      // Strip `--` comments so prose explaining the design (which mentions
      // BYPASSRLS) is not mistaken for an actual grant.
      const executableSql = rlsSql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');

      expect(executableSql).not.toMatch(/BYPASSRLS/i);
      expect(executableSql).not.toMatch(/SUPERUSER/i);
    });
  });
});
