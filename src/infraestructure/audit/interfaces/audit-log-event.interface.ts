import { AuditAction } from '../enums/audit-action.enum.js';
import { AuditSeverity } from '../enums/audit-severity.enum.js';

/**
 * Granular field-level diff entry for a single field in an UPDATE operation.
 *
 * Example:
 * ```json
 * { "name": { "before": "Juan SA", "after": "Juan SAS" } }
 * ```
 */
export interface FieldDiff {
  before: unknown;
  after: unknown;
}

/**
 * Map of changed fields for UPDATE operations.
 *
 * Example:
 * ```json
 * {
 *   "creditLimit": { "before": "500.00", "after": "1000.00" },
 *   "name":        { "before": "Acme",   "after": "Acme Corp" }
 * }
 * ```
 */
export type ChangedFieldsMap = Record<string, FieldDiff>;

/**
 * Core payload emitted to the `audit.log` event bus.
 * All fields except `action` and `resourceType` are optional — AuditService
 * enriches the remainder from AsyncLocalStorage before persisting.
 */
export interface AuditLogEvent {
  // ── WHO ───────────────────────────────────────────────────────────────────
  tenantId: string;
  userId?: string;
  impersonatedBy?: string;

  // ── WHAT ──────────────────────────────────────────────────────────────────
  action: AuditAction;
  resourceType: string;
  resourceId?: string;

  // ── CHANGE DETAIL ─────────────────────────────────────────────────────────
  /** Full state snapshot BEFORE the operation (UPDATE / DELETE). */
  before?: Record<string, unknown>;
  /** Full state snapshot AFTER the operation (CREATE / UPDATE). */
  after?: Record<string, unknown>;
  /**
   * Granular field-level diff automatically computed by AuditService
   * when both `before` and `after` are provided.
   */
  changedFields?: ChangedFieldsMap;
  /**
   * Free-form metadata bag. Use this for:
   *  - Business context (reason for change, bulk operation batch ID)
   *  - Correlation with external systems
   *  - Any key/value pair that doesn't fit other fields
   */
  metadata?: Record<string, unknown>;

  // ── WHEN / WHERE ──────────────────────────────────────────────────────────
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;

  // ── SEVERITY ─────────────────────────────────────────────────────────────
  severity?: AuditSeverity;
}
