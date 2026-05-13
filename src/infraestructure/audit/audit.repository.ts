import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, AuditAction as PrismaAuditAction } from '@prisma/client';
import { AuditLogEntity } from './domain/audit-log.entity.js';
import { QueryAuditLogDto } from './dto/query-audit-log.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a single audit log entry.
   * This is the ONLY place in the codebase that should call prisma.auditLog.create().
   */
  async create(
    data: Prisma.AuditLogUncheckedCreateInput,
  ): Promise<AuditLogEntity> {
    const raw = await this.prisma.auditLog.create({ data });
    return AuditLogEntity.fromPrisma(raw);
  }

  /**
   * Paginated, filtered query for the admin API.
   * All queries are scoped to a specific `tenantId` — no cross-tenant leakage.
   */
  async findMany(
    tenantId: string,
    dto: QueryAuditLogDto,
  ): Promise<PageDto<AuditLogEntity>> {
    const where = this.buildWhereClause(tenantId, dto);
    const skip = dto.skip;
    const take = dto.limit;
    const orderBy: Prisma.AuditLogOrderByWithRelationInput = {
      createdAt: 'desc',
    };

    const [rows, itemCount] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip, take, orderBy }),
      this.prisma.auditLog.count({ where }),
    ]);

    const entities = rows.map(AuditLogEntity.fromPrisma);
    const meta = new PageMetaDto({ itemCount, pageOptionsDto: dto });
    return new PageDto(entities, meta);
  }

  /**
   * Returns the full audit history for a specific entity instance.
   * Useful for answering "What happened to Invoice #XYZ?"
   */
  async findByEntity(
    tenantId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<AuditLogEntity[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId, resourceType, resourceId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(AuditLogEntity.fromPrisma);
  }

  /**
   * Bulk-deletes all audit logs created before `cutoff`.
   * Called by the daily purge job — NOT exposed via the API.
   *
   * @returns `{ count }` — number of rows deleted.
   */
  async deleteOlderThan(cutoff: Date): Promise<{ count: number }> {
    return this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
  }

  private buildWhereClause(
    tenantId: string,
    dto: QueryAuditLogDto,
  ): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = { tenantId };

    if (dto.userId) where.userId = dto.userId;
    if (dto.action) where.action = dto.action as unknown as PrismaAuditAction;
    if (dto.resourceType) where.resourceType = dto.resourceType;
    if (dto.resourceId) where.resourceId = dto.resourceId;
    if (dto.severity) where.severity = dto.severity as any;
    if (dto.requestId) where.requestId = dto.requestId;

    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) where.createdAt.gte = new Date(dto.startDate);
      if (dto.endDate) where.createdAt.lte = new Date(dto.endDate);
    }

    return where;
  }
}
