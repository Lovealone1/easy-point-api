import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import type { InviteTokenPayload } from '../../modules/invitations/invitations.service.js';

/**
 * InviteOrJwtGuard — composite guard for POST /auth/complete-registration.
 *
 * Tries to authenticate the request using one of two token types:
 *
 * 1. **Invite token** (`canRegister: true`, `sub: null`)
 *    Issued by GET /invitations/verify/:token for brand-new users.
 *    Skips the Redis session check because no session exists yet.
 *
 * 2. **Session JWT** (normal OTP flow, `sub: <userId>`, `sid` present)
 *    Standard stateful token. Redis session check applies.
 *
 * In both cases the decoded payload is attached to `request.user` so
 * that `@CurrentUser()` decorators work identically downstream.
 */
@Injectable()
export class InviteOrJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'fallback_secreto_desarrollo_temporal',
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // ── Branch A: Invite bypass token ─────────────────────────────────────────
    if ((payload as InviteTokenPayload).canRegister === true && payload.sub === null) {
      request['user'] = payload;
      return true;
    }

    // ── Branch B: Standard session JWT ────────────────────────────────────────
    if (!payload.sid) {
      throw new UnauthorizedException('Invalid token structure');
    }

    const sessionKey = `session_metadata:${payload.sub}:${payload.sid}`;
    const isActive = await this.redisCacheService.get(sessionKey);

    if (!isActive) {
      throw new UnauthorizedException('Session has been revoked or expired');
    }

    request['user'] = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
