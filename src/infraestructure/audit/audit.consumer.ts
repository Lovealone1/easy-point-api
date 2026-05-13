import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AUDIT_LOG_EVENT } from './constants/audit-events.constants.js';
import { AuditRepository } from './audit.repository.js';
import type { AuditLogEvent } from './interfaces/audit-log-event.interface.js';
import { AuditAction as PrismaAuditAction, AuditSeverity as PrismaAuditSeverity, Prisma } from '@prisma/client';

@Injectable()
export class AuditConsumer {
  private readonly logger = new Logger(AuditConsumer.name);

  constructor(private readonly auditRepository: AuditRepository) { }

  @OnEvent(AUDIT_LOG_EVENT, { async: true })
  async handleAuditEvent(event: AuditLogEvent): Promise<void> {
    try {
      await this.auditRepository.create({
        tenantId: event.tenantId,
        userId: event.userId ?? null,
        impersonatedBy: event.impersonatedBy ?? null,
        action: event.action as unknown as PrismaAuditAction,
        resourceType: event.resourceType,
        resourceId: event.resourceId ?? null,
        before: event.before ? (event.before as unknown as Prisma.InputJsonValue) : undefined,
        after: event.after ? (event.after as unknown as Prisma.InputJsonValue) : undefined,
        changedFields: event.changedFields ? (event.changedFields as unknown as Prisma.InputJsonValue) : undefined,
        metadata: event.metadata ? (event.metadata as unknown as Prisma.InputJsonValue) : undefined,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        requestId: event.requestId ?? null,
        sessionId: event.sessionId ?? null,
        severity: (event.severity ?? 'LOW') as unknown as PrismaAuditSeverity,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `[Audit] DB persistence failed for event ${event.action}/${event.resourceType}: ${error.message}`,
        error.stack,
      );
    }

    const structuredLog = {
      type: 'audit',
      tenantId: event.tenantId,
      userId: event.userId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      severity: event.severity,
      requestId: event.requestId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress,
      changedFieldKeys: event.changedFields
        ? Object.keys(event.changedFields)
        : undefined,
      timestamp: new Date().toISOString(),
    };

    process.stdout.write(JSON.stringify(structuredLog) + '\n');
  }
}
