import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../infraestructure/audit/audit.service.js';
import {
  AUDIT_METADATA_KEY,
  AuditOptions,
} from '../decorators/audit.decorator.js';

/**
 * AuditInterceptor — Automatically logs audit events for endpoints decorated
 * with `@Audit()`.
 *
 * Flow:
 *  1. Reads `@Audit()` metadata via Reflector
 *  2. Captures the handler's return value (the `after` state)
 *  3. Calls AuditService.log() with action, resource, and the response body
 *
 * For capturing `before` state on UPDATE/DELETE, services should call
 * `auditService.log({ before: originalEntity, after: updatedEntity, ... })`
 * directly rather than relying on the interceptor, since the interceptor
 * doesn't have access to the pre-mutation state without an extra DB round-trip.
 *
 * Register globally in AppModule or per-controller/per-route:
 * ```ts
 * // Per controller
 * @UseInterceptors(AuditInterceptor)
 * export class ClientsController { ... }
 *
 * // Per route
 * @Audit({ action: AuditAction.UPDATE, resource: 'Client' })
 * @UseInterceptors(AuditInterceptor)
 * async update(...) { ... }
 * ```
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<AuditOptions | undefined>(
      AUDIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const resourceId: string | undefined = request.params?.id;
    const user = request.user;

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        const resolvedResourceId =
          resourceId ??
          (responseBody && typeof responseBody === 'object'
            ? (responseBody as Record<string, unknown>)['id']?.toString()
            : undefined);

        this.auditService.log({
          action: options.action,
          resourceType: options.resource,
          resourceId: resolvedResourceId,
          after:
            responseBody && typeof responseBody === 'object'
              ? (responseBody as Record<string, unknown>)
              : undefined,
          severity: options.severity,
          userId: user?.sub,
          sessionId: user?.sid,
        });
      }),
    );
  }
}
