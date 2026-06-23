import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { OrganizationUsersModule } from './modules/organization-users/organization-users.module.js';
import { InvitationsModule } from './modules/invitations/invitations.module.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { SuppliersModule } from './modules/suppliers/suppliers.module.js';
import { EmployeesModule } from './modules/employees/employees.module.js';
import { SuppliesModule } from './modules/supplies/supplies.module.js';
import { ProductCategoriesModule } from './modules/product-categories/product-categories.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { RecipesModule } from './modules/recipes/recipes.module.js';
import { ProductStocksModule } from './modules/product-stocks/product-stocks.module.js';
import { InventoryMovementsModule } from './modules/inventory-movements/inventory-movements.module.js';
import { SupplyStocksModule } from './modules/supply-stocks/supply-stocks.module.js';
import { SupplyMovementsModule } from './modules/supply-movements/supply-movements.module.js';
import { TransactionCategoriesModule } from './modules/transaction-categories/transaction-categories.module.js';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module.js';
import { FinancialTransactionsModule } from './modules/financial-transactions/financial-transactions.module.js';
import { SupplyPurchasesModule } from './modules/supply-purchases/supply-purchases.module.js';
import { ProductPurchasesModule } from './modules/product-purchases/product-purchases.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
import { UtilitiesModule } from './modules/utilities/utilities.module.js';
import { SupplyStockEntriesModule } from './modules/supply-stock-entries/supply-stock-entries.module.js';
import { ProductionsModule } from './modules/productions/productions.module.js';
import { ConfigModule } from '@nestjs/config';
import { JsonBodyMiddleware } from './common/middlewares/json-body.middleware.js';
import { LoggerMiddleware } from './common/middlewares/logger.middleware.js';
import { RequestInfoMiddleware } from './common/middlewares/request-info.middleware.js';
import { RateLimitMiddleware } from './common/middlewares/rate-limit.middleware.js';
import { TenantMiddleware } from './common/middlewares/tenant.middleware.js';
import { RedisModule } from './infraestructure/redis/redis.module.js';
import appConfig from './common/config/config.js';
import { MailService } from './infraestructure/mail/mail.service.js';
import { CronModule } from './common/cron/cron.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { AuditModule } from './infraestructure/audit/audit.module.js';
import { DiscountRulesModule } from './modules/discount-rules/discount-rules.module.js';
import { StorageModule } from './infraestructure/storage/storage.module.js';
import { OrganizationConfigsModule } from './modules/organization-configs/organization-configs.module.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';
import { SystemModulesModule } from './modules/system-modules/system-modules.module.js';
import { OrganizationModulesModule } from './modules/organization-modules/organization-modules.module.js';
import { RolePermissionsModule } from './modules/role-permissions/role-permissions.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AdminDashboardModule } from './modules/admin-dashboard/admin-dashboard.module.js';
import { ExpenseCategoriesModule } from './modules/expense-categories/expense-categories.module.js';
import { ExpensesModule } from './modules/expenses/expenses.module.js';
import { PlansModule } from './modules/plans/plans.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig],
    }),
    // Event bus — must be registered at root level
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    RedisModule,
    PrismaModule,
    // ── Audit (Global — AuditService injectable everywhere) ────────────────
    AuditModule,
    // ── Storage (Global — StorageService injectable everywhere) ────────────
    StorageModule,
    // ── Feature modules ───────────────────────────────────────────────────
    AuthModule,
    OrganizationsModule,
    OrganizationConfigsModule,
    OrganizationUsersModule,
    InvitationsModule,
    ClientsModule,
    SuppliersModule,
    EmployeesModule,
    SuppliesModule,
    ProductCategoriesModule,
    ProductsModule,
    RecipesModule,
    ProductStocksModule,
    InventoryMovementsModule,
    SupplyStocksModule,
    SupplyMovementsModule,
    TransactionCategoriesModule,
    BankAccountsModule,
    FinancialTransactionsModule,
    SupplyPurchasesModule,
    ProductPurchasesModule,
    UtilitiesModule,
    SalesModule,
    SupplyStockEntriesModule,
    ProductionsModule,
    CronModule,
    RolesModule,
    PermissionsModule,
    SystemModulesModule,
    OrganizationModulesModule,
    RolePermissionsModule,
    DiscountRulesModule,
    UsersModule,
    AdminDashboardModule,
    ExpenseCategoriesModule,
    ExpensesModule,
    PlansModule,
  ],
  controllers: [],
  providers: [MailService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        JsonBodyMiddleware,
        RequestInfoMiddleware,
        LoggerMiddleware,
        TenantMiddleware,
        RateLimitMiddleware,
      )
      .forRoutes('{*path}');
  }
}
