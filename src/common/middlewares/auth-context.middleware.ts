import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../config/config.js';
import { getTenantContext } from '../context/tenant.context.js';

/**
 * Best-effort JWT decoding that runs BEFORE the guards, so that request.user
 * is already populated by the time RateLimitMiddleware and TenantMiddleware
 * run (they need it to key limits per-user and to validate the
 * x-bypass-tenant header against the caller's role).
 *
 * This middleware never rejects the request — an invalid/missing/expired
 * token simply leaves request.user undefined and the flow continues as
 * anonymous. JwtAuthGuard remains the single source of truth for actually
 * enforcing authentication (including the stateful Redis session check).
 */
@Injectable()
export class AuthContextMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  async use(request: Request, _response: Response, next: NextFunction): Promise<void> {
    const token = this.extractToken(request);

    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.config.jwt.secret,
        });

        (request as Request & { user?: unknown }).user = payload;

        const store = getTenantContext();
        if (store) {
          store.userId = payload.sub;
          store.sessionId = payload.sid;
        }
      } catch {
        // Invalid/expired token: leave request.user undefined, let downstream
        // guards reject the request on the routes that actually require auth.
      }
    }

    next();
  }

  private extractToken(request: Request): string | undefined {
    const [type, headerToken] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && headerToken) {
      return headerToken;
    }

    return request.cookies?.access_token;
  }
}
