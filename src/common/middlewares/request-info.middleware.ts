import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export interface RequestWithMetadata extends Request {
  clientIp: string;
  userAgent: string;
}

declare global {
  namespace Express {
    interface Request {
      clientIp: string;
      userAgent: string;
    }
  }
}

@Injectable()
export class RequestInfoMiddleware implements NestMiddleware {
  use(
    request: RequestWithMetadata,
    _response: Response,
    next: NextFunction,
  ): void {
    request.clientIp = this.extractClientIp(request);
    request.userAgent = this.extractUserAgent(request);

    next();
  }

  private extractClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      return forwardedFor[0].split(',')[0].trim();
    }

    return request.socket.remoteAddress || request.ip || 'unknown';
  }

  private extractUserAgent(request: Request): string {
    const userAgent = request.headers['user-agent'];

    if (Array.isArray(userAgent)) {
      return userAgent[0] || 'unknown';
    }

    return userAgent || 'unknown';
  }
}
