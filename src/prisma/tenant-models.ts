/**
 * Models carrying an `organizationId` that must be scoped to the current tenant
 * automatically by the Prisma extension in `prisma.service.ts`.
 *
 * This is the ORM-level convenience layer. It is NOT the security boundary —
 * Postgres Row-Level Security is (see the `enable_rls` migration). Keep both
 * lists in sync: anything here should also have an RLS policy.
 */
export const TENANT_AWARE_MODELS: ReadonlySet<string> = new Set([
  'OrganizationUser',
  'OrganizationConfig',
  'Client',
  'Supplier',
  'Employee',
  'Supply',
  'ProductCategory',
  'Product',
  'Recipe',
  'ProductStock',
  'InventoryMovement',
  'SupplyStock',
  'SupplyMovement',
  'SupplyStockEntry',
  'BankAccount',
  'FinancialTransaction',
  'SupplyPurchase',
  'ProductPurchase',
  'Sale',
  'SaleUtility',
  'SaleItemUtility',
  'TransactionCategory',
  'Production',
  'Role',
  'RolePermission',
  'DiscountRule',
  'AppliedDiscount',
  'ExpenseCategory',
  'Expense',
]);

/**
 * Models that carry `organizationId` but are deliberately NOT auto-scoped,
 * because they are read across organizations by legitimate flows:
 *
 *  - `Invitation`  — looked up by its unique token during acceptance, when the
 *                    invitee is not yet a member of the organization and no
 *                    tenant context exists.
 *  - `Subscription` / `Invoice` — read across tenants by the global admin
 *                    dashboard and by the subscription lifecycle cron.
 *  - `OrganizationModule` — resolved by `PermissionsGuard` and assigned by
 *                    global admins.
 *
 * These still filter by `organizationId` explicitly in their services.
 */
export const TENANT_EXEMPT_MODELS: ReadonlySet<string> = new Set([
  'Invitation',
  'Subscription',
  'Invoice',
  'OrganizationModule',
]);

/** Operations whose `where` clause should be constrained to the tenant. */
export const WHERE_SCOPED_OPERATIONS: ReadonlySet<string> = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/** Operations whose `data` payload should be stamped with the tenant. */
export const DATA_SCOPED_OPERATIONS: ReadonlySet<string> = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
]);
