import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { Request } from 'express';
import { SessionScope } from '@prisma/client';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { SESSION_SCOPE_KEY } from '../decorators/session-scope.decorator.js';
import {
  LAST_SEEN_RESOLUTION_MS,
  sessionMetadataKey,
  type SessionMetadata,
} from '../../modules/auth/session.constants.js';
import appConfig from '../config/config.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly redisCacheService: RedisCacheService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.jwt.secret,
      });

      // Which application this token belongs to. Tokens minted before the
      // dashboard and the console were split carry no scope at all; they are
      // rejected rather than assumed to be dashboard tokens, so nobody keeps a
      // pre-split session that predates these checks. Costs one sign-in on the
      // release that ships this, and nothing afterwards.
      const scope: SessionScope | undefined = payload.scope;
      if (scope !== SessionScope.TENANT && scope !== SessionScope.ADMIN) {
        throw new UnauthorizedException('Session has been revoked or expired');
      }

      // Routes may pin themselves to one application. Without this, a console
      // token would be accepted by POST /auth/logout and revoke the console
      // session while the caller clears the dashboard cookies.
      const requiredScope = this.reflector.getAllAndOverride<SessionScope>(SESSION_SCOPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (requiredScope && scope !== requiredScope) {
        throw new UnauthorizedException('This session cannot be used on this endpoint');
      }

      // STATEFUL CHECK: Verify if the session ID (sid) is still active in Redis.
      // The key is namespaced by scope, so revoking one application's session
      // leaves the other's entry untouched.
      const sessionKey = sessionMetadataKey(scope, payload.sub, payload.sid);
      const session = await this.redisCacheService.get<SessionMetadata>(sessionKey);

      if (!session) {
        throw new UnauthorizedException('Session has been revoked or expired');
      }

      this.recordActivity(sessionKey, session);

      // Attach the user payload to the request object so our route handlers can access it
      request['user'] = payload;
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  /**
   * Keeps `lastSeenAt` roughly current so the account-settings session list
   * can say when a device was last used.
   *
   * Deliberately not awaited: this is a convenience field on a read path that
   * every authenticated request goes through, and a slow or failing Redis
   * write must not turn into a failed request. It is also throttled to
   * LAST_SEEN_RESOLUTION_MS, so a busy session costs one extra write every
   * few minutes rather than one per request.
   */
  private recordActivity(sessionKey: string, session: SessionMetadata): void {
    const lastSeen = Date.parse(session.lastSeenAt ?? session.createdAt);
    const now = Date.now();

    if (Number.isFinite(lastSeen) && now - lastSeen < LAST_SEEN_RESOLUTION_MS) {
      return;
    }

    void this.redisCacheService
      .setPreservingTtl(sessionKey, { ...session, lastSeenAt: new Date(now).toISOString() })
      .catch((error: Error) =>
        this.logger.warn(`Failed to record session activity: ${error.message}`),
      );
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
