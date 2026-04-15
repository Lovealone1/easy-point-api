import {
  HttpStatus,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response, json } from 'express';

const JSON_BODY_LIMIT = '1mb';

@Injectable()
export class JsonBodyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JsonBodyMiddleware.name);
  private readonly jsonParser = json({
    limit: JSON_BODY_LIMIT,
    type: (request: Request) => this.shouldParse(request),
  });

  use(request: Request, response: Response, next: NextFunction): void {
    this.jsonParser(request, response, (error?: unknown) => {
      if (!error) {
        next();
        return;
      }

      if (this.isPayloadTooLargeError(error)) {
        response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          message: `JSON payload exceeds the maximum size of ${JSON_BODY_LIMIT}`,
          error: 'Payload Too Large',
        });
        return;
      }

      const parserError = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `JSON body parser error: ${parserError.message}`,
        parserError.stack,
      );
      next(error);
    });
  }

  private shouldParse(request: Request): boolean {
    if (this.shouldBypass(request)) {
      return false;
    }

    return Boolean(
      request.is('application/json') || request.is('application/*+json'),
    );
  }

  private shouldBypass(request: Request): boolean {
    const requestPath = (request.originalUrl || request.path || '').split('?')[0];

    return (
      requestPath === '/api/docs' ||
      requestPath.startsWith('/api/docs/') ||
      requestPath === '/docs' ||
      requestPath.startsWith('/docs/')
    );
  }

  private isPayloadTooLargeError(error: unknown): boolean {
    return (
      error instanceof Error &&
      'type' in error &&
      (error as Error & { type?: string }).type === 'entity.too.large'
    );
  }
}
