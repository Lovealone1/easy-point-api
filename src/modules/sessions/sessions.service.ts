import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SessionScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { AuditService } from '../../infraestructure/audit/audit.service.js';
import { AuditAction } from '../../infraestructure/audit/enums/audit-action.enum.js';
import { AuditSeverity } from '../../infraestructure/audit/enums/audit-severity.enum.js';
import {
  sessionMetadataKey,
  userSessionsKey,
  type SessionMetadata,
} from '../auth/session.constants.js';
import { byMostRecentlyUsed, toSessionView, type SessionView } from './domain/session-view.js';

/** Both applications, in the order a reader cares about them. */
const ALL_SCOPES: readonly SessionScope[] = [SessionScope.ADMIN, SessionScope.TENANT];

/**
 * The read and revoke half of session management: what `GET /me/sessions`
 * shows, what the console shows for another user, and what `AuthService`
 * delegates to so there is exactly one place that knows how a session is
 * stored.
 *
 * Minting sessions stays in `AuthService`, which owns the tokens they are
 * paired with. This service never issues anything.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly redisCacheService: RedisCacheService,
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Fails with 404 for an id nobody holds.
   *
   * Queried here rather than through `UsersService` on purpose: this module
   * is a dependency of `UsersModule`, which needs it to sign a user out after
   * an email change. Reaching back the other way would put the two modules in
   * a cycle for the sake of one existence check.
   */
  async assertUserExists(userId: string): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  }

  /**
   * A user's live sessions in one application.
   *
   * Scoped deliberately: the dashboard has no business listing console
   * sessions. The console reaches across both scopes through
   * `listAllScopes`, which is an administrative act and audited as one.
   */
  async list(
    userId: string,
    scope: SessionScope = SessionScope.TENANT,
    currentSid?: string,
  ): Promise<SessionView[]> {
    const sessionIds = await this.redisCacheService.smembers(userSessionsKey(scope, userId));
    if (sessionIds.length === 0) return [];

    const stored = await this.redisCacheService.mget<SessionMetadata>(
      sessionIds.map(sid => sessionMetadataKey(scope, userId, sid)),
    );

    // A sid whose metadata has expired is a tombstone in the set: Redis
    // expires the blob but cannot reach into the set that references it.
    const expiredSids: string[] = [];
    const views: SessionView[] = [];

    stored.forEach((metadata, index) => {
      if (metadata === null) {
        expiredSids.push(sessionIds[index]);
        return;
      }
      views.push(toSessionView(metadata, scope, currentSid));
    });

    if (expiredSids.length > 0) {
      await Promise.all(
        expiredSids.map(sid => this.redisCacheService.srem(userSessionsKey(scope, userId), sid)),
      ).catch(error => this.logger.warn(`Failed to clean expired sessions: ${error.message}`));
    }

    return views.sort(byMostRecentlyUsed);
  }

  /** Every live session a user holds, dashboard and console alike. */
  async listAllScopes(userId: string, currentSid?: string): Promise<SessionView[]> {
    const perScope = await Promise.all(
      ALL_SCOPES.map(scope => this.list(userId, scope, currentSid)),
    );
    return perScope.flat().sort(byMostRecentlyUsed);
  }

  /**
   * Drops the Redis pair for one session without auditing or complaining that
   * it was already gone. Used by sign-out, where the caller does its own
   * logging and the session is expected to disappear.
   */
  async forget(userId: string, sid: string, scope: SessionScope): Promise<void> {
    await Promise.all([
      this.redisCacheService.delete(sessionMetadataKey(scope, userId, sid)),
      this.redisCacheService.srem(userSessionsKey(scope, userId), sid),
    ]);
  }

  /**
   * Terminates one session, and says so in the audit log.
   *
   * `actorUserId` is separate from `userId` because a global administrator
   * may revoke somebody else's session; the log has to record who pulled the
   * trigger, not only who was signed out.
   */
  async revoke(
    userId: string,
    sid: string,
    scope: SessionScope,
    actorUserId: string,
  ): Promise<{ message: string }> {
    const exists = await this.redisCacheService.get(sessionMetadataKey(scope, userId, sid));

    if (!exists) {
      throw new NotFoundException(`Session with ID ${sid} not found`);
    }

    await this.forget(userId, sid, scope);

    this.logger.log(`Session ${sid} (${scope}) of user ${userId} revoked by ${actorUserId}`);

    this.auditService.log({
      action: AuditAction.SESSION_KILL,
      resourceType: 'Session',
      resourceId: sid,
      userId: actorUserId,
      metadata: {
        killedSessionId: sid,
        sessionScope: scope,
        targetUserId: userId,
        onBehalfOfAnotherUser: actorUserId !== userId,
      },
      severity: AuditSeverity.CRITICAL,
    });

    return { message: 'Session terminated successfully' };
  }

  /**
   * Terminates a session identified only by its id, searching both
   * applications for it.
   *
   * Only the console uses this. A session id is a UUID minted per sign-in, so
   * there is nothing to disambiguate between the two namespaces — and making
   * an administrator supply the scope alongside an id they copied out of a
   * list is a papercut with no security value, since they may revoke either
   * one anyway.
   */
  async revokeAnyScope(
    userId: string,
    sid: string,
    actorUserId: string,
  ): Promise<{ message: string }> {
    for (const scope of ALL_SCOPES) {
      const exists = await this.redisCacheService.get(sessionMetadataKey(scope, userId, sid));
      if (exists) {
        return this.revoke(userId, sid, scope, actorUserId);
      }
    }

    throw new NotFoundException(`Session with ID ${sid} not found`);
  }

  /**
   * Signs the user out everywhere except the session making the request.
   *
   * Scoped to one application on purpose. "Sign out my other devices" from
   * the dashboard means the dashboard; the panic button that crosses both is
   * `POST /auth/logout-all`.
   */
  async revokeOthers(
    userId: string,
    scope: SessionScope,
    keepSid: string,
  ): Promise<{ message: string; revoked: number }> {
    const sessionIds = await this.redisCacheService.smembers(userSessionsKey(scope, userId));
    const doomed = sessionIds.filter(sid => sid !== keepSid);

    await Promise.all(doomed.map(sid => this.forget(userId, sid, scope)));

    // The refresh tokens of the sessions just dropped are now unusable —
    // `refreshToken` checks Redis before it rotates — but they are rows we
    // know are dead, and there is no sid on them to delete selectively. They
    // are cleaned up by expiry; see the note in docs/SESSIONS.md.
    if (doomed.length > 0) {
      this.logger.log(`User ${userId} revoked ${doomed.length} other ${scope} session(s)`);

      this.auditService.log({
        action: AuditAction.SESSION_KILL,
        resourceType: 'Session',
        userId,
        sessionId: keepSid,
        metadata: { sessionScope: scope, revoked: doomed.length, keptSessionId: keepSid },
        severity: AuditSeverity.HIGH,
      });
    }

    return { message: 'Other sessions terminated successfully', revoked: doomed.length };
  }

  /**
   * Every session in both applications, plus every refresh token.
   *
   * Backs `POST /auth/logout-all` and the console's "sign this user out
   * everywhere". Deliberately the one operation that crosses the split: a
   * person reaching for it means everything.
   */
  async revokeAll(userId: string, actorUserId: string): Promise<number> {
    let sessionCount = 0;

    for (const scope of ALL_SCOPES) {
      const setKey = userSessionsKey(scope, userId);
      const sessionIds = await this.redisCacheService.smembers(setKey);
      sessionCount += sessionIds.length;

      const keysToDelete = sessionIds.map(sid => sessionMetadataKey(scope, userId, sid));
      keysToDelete.push(setKey);

      await Promise.all(keysToDelete.map(key => this.redisCacheService.delete(key)));
    }

    await this.prismaService.refreshToken.deleteMany({ where: { userId } });

    this.logger.log(
      `User ${userId} signed out of every device and both applications by ${actorUserId}`,
    );

    return sessionCount;
  }
}
