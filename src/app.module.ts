import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig],
    }),
    RedisModule,
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    OrganizationUsersModule,
    InvitationsModule,
    ClientsModule,
    SuppliersModule,
    EmployeesModule,
    SuppliesModule,
    ProductCategoriesModule,
    ProductsModule,
    RecipesModule,
    CronModule,
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
