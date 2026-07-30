import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../common/config/config.js';

export const DEFAULT_DATABASE_ID = 'default';

/**
 * Resolves an organization's `databaseId` to a connection string.
 *
 * Today every organization resolves to the single shared database, so this is
 * effectively a constant — that is deliberate. It exists so that pinning one
 * tenant to a dedicated database later (because a customer requires physical
 * isolation by contract, or because one tenant's load justifies it) is a
 * configuration change plus a `databaseId` update, rather than an application
 * rewrite.
 *
 * Additional databases are declared via `TENANT_DATABASE_URLS` as a
 * comma-separated list of `id=connectionString` pairs, e.g.
 *   TENANT_DATABASE_URLS="acme=postgresql://user:pass@host:5432/acme"
 *
 * Isolation between tenants sharing the default database is enforced by
 * Postgres RLS, not by this registry.
 */
@Injectable()
export class DatabaseRegistryService {
  private readonly logger = new Logger(DatabaseRegistryService.name);
  private readonly connectionStrings = new Map<string, string>();

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {
    this.connectionStrings.set(DEFAULT_DATABASE_ID, this.config.database.url);

    for (const [id, url] of Object.entries(this.config.database.tenantUrls)) {
      this.connectionStrings.set(id, url);
      this.logger.log(`Registered dedicated tenant database "${id}"`);
    }
  }

  /**
   * Returns the connection string for a logical database id, falling back to
   * the shared default. An unknown id is a misconfiguration, not a reason to
   * fail the request — but it must be loud, since silently serving a tenant
   * from the wrong database is exactly what this seam exists to prevent.
   */
  resolveConnectionString(databaseId: string | null | undefined): string {
    if (!databaseId || databaseId === DEFAULT_DATABASE_ID) {
      return this.connectionStrings.get(DEFAULT_DATABASE_ID)!;
    }

    const connectionString = this.connectionStrings.get(databaseId);

    if (!connectionString) {
      this.logger.error(
        `Organization points at databaseId "${databaseId}", which is not configured in TENANT_DATABASE_URLS. Falling back to the default database.`,
      );
      return this.connectionStrings.get(DEFAULT_DATABASE_ID)!;
    }

    return connectionString;
  }

  /** Logical database ids currently known to the application. */
  get registeredDatabaseIds(): string[] {
    return [...this.connectionStrings.keys()];
  }

  isDedicated(databaseId: string | null | undefined): boolean {
    return Boolean(databaseId) && databaseId !== DEFAULT_DATABASE_ID;
  }
}
