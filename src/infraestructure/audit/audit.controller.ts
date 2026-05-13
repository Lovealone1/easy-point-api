import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuditRepository } from './audit.repository.js';
import { QueryAuditLogDto } from './dto/query-audit-log.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';
import { getTenantId } from '../../common/context/tenant.context.js';

/**
 * AuditController — Internal/admin endpoints for querying audit logs.
 * Requires GlobalRole.ADMIN and a valid x-organization-id header.
 */
@ApiTags('Audit')
@ApiSecurity('x-organization-id')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditRepository: AuditRepository) {}

  private getOrgIdOrThrow(): string {
    const orgId = getTenantId();
    if (!orgId) {
      throw new BadRequestException(
        'x-organization-id header is required for audit queries',
      );
    }
    return orgId;
  }

  /** GET /api/v1/audit — Paginated, filterable audit log list for a tenant. */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List audit logs',
    description:
      'Returns a paginated list of audit events for the current tenant. ' +
      'Supports filtering by user, action, resource type/ID, severity, and date range.',
  })
  @ApiOkResponse({ description: 'Paginated audit log list' })
  @ApiBadRequestResponse({ description: 'Missing x-organization-id header' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  async findAll(@Query() dto: QueryAuditLogDto) {
    return this.auditRepository.findMany(this.getOrgIdOrThrow(), dto);
  }

  /** GET /api/v1/audit/entity/:type/:id — Full chronological history of one entity. */
  @Get('entity/:resourceType/:resourceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Entity audit history',
    description: 'Returns the full audit trail for a specific entity record.',
  })
  @ApiOkResponse({ description: 'Entity audit history' })
  async findByEntity(
    @Param('resourceType') resourceType: string,
    @Param('resourceId', new ParseUUIDPipe({ optional: true }))
    resourceId: string,
  ) {
    return this.auditRepository.findByEntity(
      this.getOrgIdOrThrow(),
      resourceType,
      resourceId,
    );
  }
}
