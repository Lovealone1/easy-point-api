import { SetMetadata } from '@nestjs/common';
import { SessionScope } from '@prisma/client';

export const SESSION_SCOPE_KEY = 'requiredSessionScope';

/**
 * Pins a route to one of the two applications. `JwtAuthGuard` rejects a token
 * minted for the other scope even though the signature and the Redis session
 * are both valid.
 *
 * Needed on the session-management routes above all: without it, presenting a
 * console token to `POST /auth/logout` would revoke the console session while
 * the caller clears the dashboard's cookies, leaving the two out of sync.
 */
export const RequireSessionScope = (scope: SessionScope) => SetMetadata(SESSION_SCOPE_KEY, scope);
