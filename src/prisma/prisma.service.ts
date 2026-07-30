import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import appConfig from '../common/config/config.js';
import {
  getTenantContext,
  runAsSystem,
  runWithGucApplied,
} from '../common/context/tenant.context.js';
import {
  TENANT_AWARE_MODELS,
  WHERE_SCOPED_OPERATIONS,
  DATA_SCOPED_OPERATIONS,
} from './tenant-models.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(appConfig.KEY)
    config: ConfigType<typeof appConfig>,
  ) {
    const connectionString = config.database.url;
    if (!connectionString) throw new Error('DATABASE_URL is missing');

    const adapter = new PrismaPg({ connectionString });
    super({ adapter });

    // Populated immediately below, before any query can run. The extension
    // closure needs to reach the *extended* client (the one carrying
    // $tenantTransaction), which does not exist yet at definition time.
    const selfRef: {
      $transaction: PrismaClient['$transaction'];
      $executeRaw: PrismaClient['$executeRaw'];
    } = {} as any;

    const extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_AWARE_MODELS.has(model)) {
              return query(args);
            }

            const ctx = getTenantContext();

            // Already inside a $tenantTransaction / $systemTransaction: the
            // setting is published on this connection, nothing more to do.
            if (ctx?.gucApplied) {
              return query(args);
            }

            // Cross-tenant read by a global admin. The ORM filter is skipped by
            // design, but Postgres still needs to be told — otherwise RLS sees
            // no setting at all and (correctly) returns nothing.
            if (ctx?.bypassTenant) {
              const [, bypassResult] = await selfRef.$transaction([
                selfRef.$executeRaw`SELECT set_config('app.bypass_tenant', 'on', TRUE)`,
                query(args) as any,
              ]);
              return bypassResult;
            }

            // No tenant in context: leave it to RLS, which matches zero rows.
            // Server-side flows that legitimately span tenants must declare
            // themselves via $systemTransaction rather than relying on this.
            if (!ctx?.organizationId) {
              return query(args);
            }

            const organizationId = ctx.organizationId;
            const mutableArgs = (args || {}) as any;

            if (WHERE_SCOPED_OPERATIONS.has(operation)) {
              // Only apply as a DEFAULT. A caller that names an organizationId
              // explicitly is doing so deliberately (e.g. bootstrapping a newly
              // created organization) and must not be silently redirected to
              // whatever organization happens to be in the request context.
              // RLS is what makes an out-of-tenant value actually unauthorized.
              if (mutableArgs.where?.organizationId === undefined) {
                mutableArgs.where = { ...mutableArgs.where, organizationId };
              }
            } else if (DATA_SCOPED_OPERATIONS.has(operation)) {
              const stamp = (payload: any) =>
                payload?.organizationId === undefined
                  ? { ...payload, organizationId }
                  : payload;

              if (Array.isArray(mutableArgs.data)) {
                mutableArgs.data = mutableArgs.data.map(stamp);
              } else if (mutableArgs.data) {
                mutableArgs.data = stamp(mutableArgs.data);
              }
            } else if (operation === 'upsert') {
              if (mutableArgs.where?.organizationId === undefined) {
                mutableArgs.where = { ...mutableArgs.where, organizationId };
              }
              if (mutableArgs.create?.organizationId === undefined) {
                mutableArgs.create = { ...mutableArgs.create, organizationId };
              }
            }

            // RLS reads the tenant from a transaction-local Postgres setting.
            // A standalone query has no transaction, so nothing would be set and
            // the policy would (correctly, but unhelpfully) match zero rows.
            //
            // The array form of $transaction runs both statements on the SAME
            // connection inside one transaction, which is what makes
            // `set_config(..., TRUE)` visible to the query. Re-dispatching
            // through `tx[model][operation]` instead would re-enter this hook
            // and open a transaction per query until the pool is exhausted.
            const [, result] = await selfRef.$transaction([
              selfRef.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`,
              query(args) as any,
            ]);
            return result;
          },
        },
      },
    });

    const finalClient = extendedClient as any;

    // Interactive transaction that publishes the tenant to Postgres for the
    // lifetime of the transaction, so RLS policies can see it. Use this instead
    // of `$transaction(async tx => ...)` anywhere the callback touches
    // tenant-scoped tables — queries issued through `tx` bypass the extension
    // above, so without this they would run with no tenant GUC set and RLS
    // would (correctly) return zero rows.
    finalClient.$tenantTransaction = async function <T>(
      fn: (tx: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
      return this.$transaction(async (tx: Prisma.TransactionClient) => {
        const ctx = getTenantContext();

        if (ctx?.bypassTenant) {
          await tx.$executeRaw`SELECT set_config('app.bypass_tenant', 'on', TRUE)`;
        } else if (ctx?.organizationId) {
          await tx.$executeRaw`SELECT set_config('app.current_org_id', ${ctx.organizationId}, TRUE)`;
        }

        // Everything inside now runs with the tenant already published, so the
        // extension must not wrap each query in yet another transaction.
        return runWithGucApplied(() => fn(tx));
      });
    };

    // Escape hatch for control-plane work that legitimately spans tenants:
    // cron jobs, organization bootstrapping, global-admin reads. Sets the
    // bypass GUC transaction-locally (never session-wide, which would leak to
    // the next request that reuses the pooled connection).
    finalClient.$systemTransaction = async function <T>(
      fn: (tx: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
      return runAsSystem(() =>
        this.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.$executeRaw`SELECT set_config('app.bypass_tenant', 'on', TRUE)`;
          return runWithGucApplied(() => fn(tx));
        }),
      );
    };

    selfRef.$transaction = finalClient.$transaction.bind(finalClient);
    selfRef.$executeRaw = finalClient.$executeRaw.bind(finalClient);

    finalClient.onModuleInit = async () => { await this.$connect(); };
    finalClient.onModuleDestroy = async () => { await this.$disconnect(); };

    return finalClient as this;
  }

  /**
   * Runs `fn` inside a transaction with the current tenant published to
   * Postgres via `app.current_org_id`, so RLS policies apply to every
   * statement issued through `tx`.
   */
  declare $tenantTransaction: <T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => Promise<T>;

  /**
   * Runs `fn` in a cross-tenant (control-plane) transaction. Only for trusted
   * server-side flows: cron jobs, organization creation, global-admin reads.
   */
  declare $systemTransaction: <T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => Promise<T>;

  async onModuleInit() { }
  async onModuleDestroy() { }
}
