import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { Request } from 'express';
import { SessionScope } from '@prisma/client';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { SESSION_SCOPE_KEY } from '../decorators/session-scope.decorator.js';
import { sessionMetadataKey } from '../../modules/auth/session.constants.js';
import appConfig from '../config/config.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
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
      const isActive = await this.redisCacheService.get(sessionKey);

      if (!isActive) {
        throw new UnauthorizedException('Session has been revoked or expired');
      }

      // Attach the user payload to the request object so our route handlers can access it
      request['user'] = payload;
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
