import { AuditAction, AuditSeverity } from '@prisma/client';

/**
 * Domain entity for a single audit log record.
 * Immutable by design — audit logs are never mutated after creation.
 */
export class AuditLogEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string | null;
  readonly impersonatedBy: string | null;
  readonly action: AuditAction;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly before: unknown;
  readonly after: unknown;
  readonly changedFields: unknown;
  readonly metadata: unknown;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly requestId: string | null;
  readonly sessionId: string | null;
  readonly severity: AuditSeverity;
  readonly createdAt: Date;

  private constructor(params: {
    id: string;
    tenantId: string;
    userId: string | null;
    impersonatedBy: string | null;
    action: AuditAction;
    resourceType: string;
    resourceId: string | null;
    before: unknown;
    after: unknown;
    changedFields: unknown;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string | null;
    sessionId: string | null;
    severity: AuditSeverity;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.tenantId = params.tenantId;
    this.userId = params.userId;
    this.impersonatedBy = params.impersonatedBy;
    this.action = params.action;
    this.resourceType = params.resourceType;
    this.resourceId = params.resourceId;
    this.before = params.before;
    this.after = params.after;
    this.changedFields = params.changedFields;
    this.metadata = params.metadata;
    this.ipAddress = params.ipAddress;
    this.userAgent = params.userAgent;
    this.requestId = params.requestId;
    this.sessionId = params.sessionId;
    this.severity = params.severity;
    this.createdAt = params.createdAt;
  }

  static fromPrisma(raw: {
    id: string;
    tenantId: string;
    userId: string | null;
    impersonatedBy: string | null;
    action: AuditAction;
    resourceType: string;
    resourceId: string | null;
    before: unknown;
    after: unknown;
    changedFields: unknown;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string | null;
    sessionId: string | null;
    severity: AuditSeverity;
    createdAt: Date;
  }): AuditLogEntity {
    return new AuditLogEntity(raw);
  }
}
