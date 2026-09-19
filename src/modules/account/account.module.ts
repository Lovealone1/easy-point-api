import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { UserInfoModule } from '../user-info/user-info.module.js';
import { AccountController } from './account.controller.js';
import { AccountBillingController } from './account-billing.controller.js';

/**
 * Account settings — everything under `/me` that a person manages about their
 * own account, reusing the services the administrative controllers already
 * call rather than reimplementing them.
 *
 * Controllers only, no providers of its own: the difference between "an
 * administrator edits this user" and "this user edits themselves" is which id
 * reaches the service, and that belongs at the edge. Keeping the rules in one
 * service is what stops the two paths from drifting.
 *
 * The session list lives in `SessionsModule`, at `/me/sessions`, because
 * `AuthModule` depends on it too.
 */
@Module({
  imports: [UsersModule, UserInfoModule],
  controllers: [AccountController, AccountBillingController],
})
export class AccountModule {}
