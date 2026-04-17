import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import type { InviteTokenPayload } from '../../modules/invitations/invitations.service.js';

/**
 * Guard for routes accessible via a short-lived invitation JWT.
 *
 * This guard intentionally skips the Redis session check performed by
 * JwtAuthGuard. It only validates the token signature and asserts that
 * the payload carries `canRegister: true` and `sub: null`, which marks
 * it as an invite-bypass token (not a full session token).
 *
 * Used exclusively on POST /auth/complete-registration when the caller
 * is a brand-new user who arrived via an invitation link.
 */
@Injectable()
export class InviteTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync<InviteTokenPayload>(
        token,
        { secret: process.env.JWT_SECRET || 'fallback_secreto_desarrollo_temporal' },
      );

      // Must be an invite-issued token (sub is null, canRegister flag present)
      if (payload.sub !== null || !payload.canRegister) {
        throw new UnauthorizedException('Token is not a valid invitation token');
      }

      // Attach payload so controller decorators can read it
      (request as any)['user'] = payload;
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired invitation token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
