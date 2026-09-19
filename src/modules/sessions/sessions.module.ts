import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { SessionsService } from './sessions.service.js';
import { MySessionsController } from './my-sessions.controller.js';
import { AdminUserSessionsController } from './admin-user-sessions.controller.js';

/**
 * Reading and revoking sessions, for the account-settings screen and for the
 * administration console.
 *
 * `AuthModule` and `UsersModule` both import this one and delegate to
 * `SessionsService`, so there is a single implementation of how a session is
 * stored and torn down. The dependency runs one way only — this module knows
 * nothing about issuing tokens or managing accounts — which is what keeps
 * them all out of a cycle.
 */
@Module({
  imports: [PrismaModule],
  controllers: [MySessionsController, AdminUserSessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
