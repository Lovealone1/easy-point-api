import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import type { LimitInfo, RateLimiter } from '@/infraestructure/ratelimit/rate-limiter.interface.js';
import { RateLimitersService } from '@/infraestructure/ratelimit/rate-limiters.service.js';

type RequestWithUser = Request & {
  user?: {
    id?: string | number;
    sub?: string | number;
  };
};

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(
    private readonly rateLimitersService: RateLimitersService,
  ) {}

  async use(
    request: RequestWithUser,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const globalLimiter = this.rateLimitersService.global;
      const scopedLimiter = this.resolveScopedLimiter(request);

      if (globalLimiter) {
        const globalKey = this.buildGlobalKey(request);
        const globalDecision = await globalLimiter.allow(globalKey);

        if (!globalDecision.allowed) {
          this.applyLimitHeaders(response, globalDecision.info);
          throw this.createTooManyRequestsException('Global rate limit exceeded');
        }
      }

      if (!scopedLimiter) {
        next();
        return;
      }

      const scopedKey = this.buildScopedKey(request);
      const scopedDecision = await scopedLimiter.allow(scopedKey);

      this.applyLimitHeaders(response, scopedDecision.info);

      if (!scopedDecision.allowed) {
        throw this.createTooManyRequestsException('Rate limit exceeded');
      }

      next();
    } catch (error) {
      this.handleError(error, response, next);
    }
  }

  private resolveScopedLimiter(request: RequestWithUser): RateLimiter | null {
    if (this.hasAuthenticatedUser(request)) {
      return this.isReadOperation(request)
        ? this.rateLimitersService.readOps
        : this.rateLimitersService.writeOps;
    }

    return this.isReadOperation(request)
      ? this.rateLimitersService.moderateIp
      : this.rateLimitersService.strictIp;
  }

  private buildGlobalKey(request: RequestWithUser): string {
    return [
      'global',
      this.extractClientIp(request),
      this.getRouteScope(request),
    ].join(':');
  }

  private buildScopedKey(request: RequestWithUser): string {
    if (this.hasAuthenticatedUser(request)) {
      return [
        this.isReadOperation(request) ? 'read-ops' : 'write-ops',
        this.extractUserIdentifier(request),
        this.getRouteScope(request),
      ].join(':');
    }

    return [
      this.isReadOperation(request) ? 'moderate-ip' : 'strict-ip',
      this.extractClientIp(request),
      this.getRouteScope(request),
    ].join(':');
  }

  private applyLimitHeaders(response: Response, info: LimitInfo): void {
    response.setHeader('X-RateLimit-Limit', info.limit.toString());
    response.setHeader('X-RateLimit-Remaining', info.remaining.toString());
    response.setHeader('X-RateLimit-Reset', info.reset.toISOString());
    response.setHeader(
      'Retry-After',
      Math.ceil(info.retryAfterMs / 1000).toString(),
    );
  }

  private hasAuthenticatedUser(request: RequestWithUser): boolean {
    return Boolean(this.extractUserIdentifier(request));
  }

  private extractUserIdentifier(request: RequestWithUser): string | null {
    const userId = request.user?.id ?? request.user?.sub;

    if (userId === undefined || userId === null) {
      return null;
    }

    return String(userId);
  }

  private extractClientIp(request: RequestWithUser): string {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    return request.ip || 'unknown';
  }

  private getRouteScope(request: RequestWithUser): string {
    const normalizedPath = request.baseUrl || request.path || request.originalUrl;
    const sanitizedPath = normalizedPath
      .split('?')[0]
      .replace(/\/+/g, '/')
      .replace(/^\//, '')
      .replace(/\//g, ':');

    return sanitizedPath || 'root';
  }

  private isReadOperation(request: RequestWithUser): boolean {
    return ['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  }

  private handleError(
    error: unknown,
    response: Response,
    next: NextFunction,
  ): void {
    if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
      const status = error.getStatus();
      const errorResponse = error.getResponse();
      const message =
        typeof errorResponse === 'string'
          ? errorResponse
          : (errorResponse as { message?: string }).message || 'Too Many Requests';

      response.status(status).json({
        statusCode: status,
        message,
        error: 'Too Many Requests',
      });
      return;
    }

    const rateLimitError =
      error instanceof Error ? error : new Error(String(error));

    this.logger.error(
      `Rate limit middleware error: ${rateLimitError.message}`,
      rateLimitError.stack,
    );

    next(error);
  }

  private createTooManyRequestsException(message: string): HttpException {
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message,
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
