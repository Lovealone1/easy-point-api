import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AUDIT_LOG_EVENT } from './constants/audit-events.constants.js';
import { AuditRepository } from './audit.repository.js';
import type { AuditLogEvent } from './interfaces/audit-log-event.interface.js';
import { AuditAction as PrismaAuditAction, AuditSeverity as PrismaAuditSeverity, Prisma } from '@prisma/client';

const DEFAULT_RETENTION_DAYS = 30;

/**
 * AuditConsumer — listens to `audit.log` events and fans out to:
 *  1. PostgreSQL persistence via AuditRepository
 *  2. Structured JSON stdout for log aggregation (Loki, Datadog, OpenSearch, etc.)
 *
 * Also handles the daily purge job triggered by the `cron.daily_midnight` event.
 */
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


  @OnEvent('cron.daily_midnight', { async: true })
  async handleDailyPurge(): Promise<void> {
    const retentionDays = this.resolveRetentionDays();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    this.logger.log(
      `[AuditPurge] Running — deleting logs older than ${retentionDays} days (before ${cutoff.toISOString()})`,
    );

    try {
      const { count } = await this.auditRepository.deleteOlderThan(cutoff);
      this.logger.log(`[AuditPurge] Deleted ${count} audit log(s).`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`[AuditPurge] Failed: ${error.message}`, error.stack);
    }
  }

  private resolveRetentionDays(): number {
    const raw = process.env['AUDIT_LOG_RETENTION_DAYS'];
    const parsed = raw ? parseInt(raw, 10) : NaN;

    if (isNaN(parsed) || parsed < 1) {
      this.logger.warn(
        `[AuditPurge] Invalid AUDIT_LOG_RETENTION_DAYS="${raw}", falling back to ${DEFAULT_RETENTION_DAYS} days.`,
      );
      return DEFAULT_RETENTION_DAYS;
    }

    return parsed;
  }
}
