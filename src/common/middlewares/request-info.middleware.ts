import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import * as crypto from 'crypto';
import { getTenantContext } from '../context/tenant.context.js';

export interface RequestWithMetadata extends Request {
  clientIp: string;
  userAgent: string;
  requestId: string;
}

declare global {
  namespace Express {
    interface Request {
      clientIp: string;
      userAgent: string;
      requestId: string;
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
    // Generate or propagate a unique Request ID for distributed tracing
    request.requestId =
      (request.headers['x-request-id'] as string) || crypto.randomUUID();

    // Patch the AsyncLocalStorage store so audit context is available globally
    // without passing the HTTP request object through service layers.
    const store = getTenantContext();
    if (store) {
      store.ipAddress = request.clientIp;
      store.userAgent = request.userAgent;
      store.requestId = request.requestId;
    }

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
