import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import appConfig from '../common/config/config.js';
import { getTenantContext } from '../common/context/tenant.context.js';

// Add new models here when the database schema expands to include more tenants.
// We explicitly ignore non-tenant schemas like 'User' or 'Organization' itself.
const tenantAwareModels = ['OrganizationUser'];

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

    const extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (model && tenantAwareModels.includes(model)) {
              const ctx = getTenantContext();

              if (ctx && ctx.organizationId && !ctx.bypassTenant) {
                const organizationId = ctx.organizationId;
                const mutableArgs = (args || {}) as any;

                if (['findUnique', 'findFirst', 'findMany', 'count', 'update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
                  mutableArgs.where = { ...mutableArgs.where, organizationId };
                }
                else if (['create', 'createMany'].includes(operation)) {
                  if (Array.isArray(mutableArgs.data)) {
                    mutableArgs.data = mutableArgs.data.map((d: any) => ({ ...d, organizationId }));
                  } else if (mutableArgs.data) {
                    mutableArgs.data = { ...mutableArgs.data, organizationId };
                  }
                }
              }
            }
            return query(args);
          }
        }
      }
    });

    const finalClient = extendedClient as any;
    finalClient.onModuleInit = async () => { await this.$connect(); };
    finalClient.onModuleDestroy = async () => { await this.$disconnect(); };

    return finalClient as this;
  }

  async onModuleInit() { }
  async onModuleDestroy() { }
}
