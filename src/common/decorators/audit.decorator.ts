import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../../infraestructure/audit/enums/audit-action.enum.js';
import { AuditSeverity } from '../../infraestructure/audit/enums/audit-severity.enum.js';

export const AUDIT_METADATA_KEY = 'audit:options';

export interface AuditOptions {
  /** The type of operation being audited */
  action: AuditAction;
  /** The entity/resource being acted upon, e.g. 'Client', 'Sale', 'Role' */
  resource: string;
  /** Override the default severity inference */
  severity?: AuditSeverity;
  /**
   * When `true`, the interceptor will attempt to fetch the entity BEFORE
   * executing the handler (for UPDATE/DELETE operations) to capture the
   * `before` snapshot. Only works when the handler receives an `id` param.
   * Default: false (for performance reasons — opt-in per endpoint).
   */
  captureBeforeState?: boolean;
}

/**
 * @Audit() — Decorator to declaratively mark a controller method for auditing.
 *
 * Usage:
 * ```ts
 * @Patch(':id')
 * @Audit({ action: AuditAction.UPDATE, resource: 'Client', captureBeforeState: true })
 * async update(@Param('id') id: string, @Body() dto: UpdateClientDto) { ... }
 *
 * @Delete(':id')
 * @Audit({ action: AuditAction.DELETE, resource: 'Client', severity: AuditSeverity.HIGH })
 * async remove(@Param('id') id: string) { ... }
 * ```
 *
 * The AuditInterceptor reads this metadata and automatically logs the event
 * after the handler completes, with `before` (if available) and `after` state,
 * and the computed `changedFields` diff.
 */
export const Audit = (options: AuditOptions) =>
  SetMetadata(AUDIT_METADATA_KEY, options);
