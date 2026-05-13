import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getAuditContext, patchAuditContext } from '../../common/context/tenant.context.js';
import { sanitizePayload } from './audit.sanitizer.js';
import { AuditAction } from './enums/audit-action.enum.js';
import { AuditSeverity } from './enums/audit-severity.enum.js';
import { AUDIT_LOG_EVENT } from './constants/audit-events.constants.js';
import type {
  AuditLogEvent,
  ChangedFieldsMap,
} from './interfaces/audit-log-event.interface.js';

/** Partial input accepted by AuditService.log() */
export type AuditInput = Omit<AuditLogEvent, 'tenantId' | 'changedFields'> & {
  tenantId?: string;
  changedFields?: ChangedFieldsMap;
};

/**
 * AuditService — the single, decoupled entry point for all audit events.
 *
 * Responsibilities:
 *  1. Enrich partial events with context from AsyncLocalStorage
 *  2. Automatically compute `changedFields` diff when `before` and `after` provided
 *  3. Sanitize sensitive fields before emission
 *  4. Emit the event asynchronously (fire-and-forget) via EventEmitter2
 *
 * Usage — fire-and-forget (non-blocking):
 * ```ts
 * this.auditService.log({
 *   action: AuditAction.UPDATE,
 *   resourceType: 'Client',
 *   resourceId: client.id,
 *   before: originalClient,
 *   after:  updatedClient,
 * });
 * ```
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Fire-and-forget — does NOT block the calling request. */
  log(input: AuditInput): void {
    Promise.resolve().then(() => this.emit(input)).catch((err: Error) => {
      this.logger.error(
        `Failed to emit audit event: ${err.message}`,
        err.stack,
      );
    });
  }

  /** Awaitable variant for critical events that must be guaranteed before returning. */
  async logSync(input: AuditInput): Promise<void> {
    await this.emit(input);
  }

  /** Patches userId/sessionId into AsyncLocalStorage once JWT is validated. */
  patchUserContext(userId: string, sessionId?: string): void {
    patchAuditContext({ userId, sessionId });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async emit(input: AuditInput): Promise<void> {
    const ctx = getAuditContext();
    const tenantId = input.tenantId ?? ctx.organizationId ?? 'system';

    const event: AuditLogEvent = {
      tenantId,
      userId: input.userId ?? ctx.userId,
      impersonatedBy: input.impersonatedBy ?? ctx.impersonatedBy,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      before: input.before
        ? (sanitizePayload(input.before) as Record<string, unknown>)
        : undefined,
      after: input.after
        ? (sanitizePayload(input.after) as Record<string, unknown>)
        : undefined,
      changedFields:
        input.changedFields ??
        (input.before && input.after
          ? this.computeDiff(input.before, input.after)
          : undefined),
      metadata: input.metadata
        ? (sanitizePayload(input.metadata) as Record<string, unknown>)
        : undefined,
      ipAddress: input.ipAddress ?? ctx.ipAddress,
      userAgent: input.userAgent ?? ctx.userAgent,
      requestId: input.requestId ?? ctx.requestId,
      sessionId: input.sessionId ?? ctx.sessionId,
      severity: input.severity ?? this.defaultSeverity(input.action),
    };

    await this.eventEmitter.emitAsync(AUDIT_LOG_EVENT, event);
  }

  /**
   * Computes a granular field-level diff between `before` and `after` snapshots.
   * Returns only the fields that actually changed.
   *
   * Output example:
   * ```json
   * {
   *   "creditLimit": { "before": "500.00", "after": "1000.00" },
   *   "name":        { "before": "Acme",   "after": "Acme Corp" }
   * }
   * ```
   */
  private computeDiff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): ChangedFieldsMap {
    const diff: ChangedFieldsMap = {};
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      const bVal = before[key];
      const aVal = after[key];
      if (!this.deepEqual(bVal, aVal)) {
        diff[key] = { before: bVal, after: aVal };
      }
    }

    return diff;
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  private defaultSeverity(action: AuditAction): AuditSeverity {
    switch (action) {
      case AuditAction.LOGIN_FAILED:
      case AuditAction.SESSION_KILL:
      case AuditAction.API_KEY_CHANGE:
      case AuditAction.PASSWORD_CHANGE:
        return AuditSeverity.CRITICAL;

      case AuditAction.DELETE:
      case AuditAction.CANCEL:
      case AuditAction.ROLE_CHANGE:
      case AuditAction.PERMISSION_CHANGE:
      case AuditAction.TENANT_CONFIG_CHANGE:
        return AuditSeverity.HIGH;

      case AuditAction.CREATE:
      case AuditAction.UPDATE:
      case AuditAction.RESTORE:
      case AuditAction.EXPORT:
        return AuditSeverity.MEDIUM;

      default:
        return AuditSeverity.LOW;
    }
  }
}
