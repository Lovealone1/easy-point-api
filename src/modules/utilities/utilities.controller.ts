import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UtilitiesService } from './utilities.service.js';
import { FindUtilitiesDto } from './dto/find-utilities.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiSecurity,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Utilities')
@ApiBearerAuth()
@Controller('utilities')
export class UtilitiesController {
  constructor(private readonly utilitiesService: UtilitiesService) {}

  // ── Global Admin ────────────────────────────────────────────────────────────

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'List all sale utilities globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() query: FindUtilitiesDto) {
    return this.utilitiesService.findAll(query);
  }

  // ── Org routes — declared before :id to avoid routing conflict ──────────────

  @Get('summary')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Aggregated utility summary (Owner / Admin / Collaborator)',
    description:
      'Returns total revenue, total cost, gross profit and margin % ' +
      'for the period defined by query filters. Useful for dashboard KPIs.',
  })
  @ApiOkResponse({
    description: 'Summary object with totalRevenue, totalCost, grossProfit, marginPercent, salesCount.',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  getSummary(@Query() query: FindUtilitiesDto) {
    return this.utilitiesService.getSummary(query);
  }

  @Get('by-product')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Utility grouped by product (Owner / Admin / Collaborator)',
    description:
      'Returns the full list of products with aggregated revenue, cost, profit and margin. ' +
      'Not paginated — intended for reporting/dashboards.',
  })
  @ApiOkResponse({ description: 'Array of product utility rows.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  getByProduct(@Query() query: FindUtilitiesDto) {
    return this.utilitiesService.getByProduct(query);
  }

  @Get('by-category')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Utility grouped by product category (Owner / Admin / Collaborator)',
    description:
      'Returns categories with aggregated utility metrics. ' +
      'Products without a category appear under null.',
  })
  @ApiOkResponse({ description: 'Array of category utility rows.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  getByCategory(@Query() query: FindUtilitiesDto) {
    return this.utilitiesService.getByCategory(query);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Paginated list of sale utilities (Owner / Admin / Collaborator)',
    description:
      'Each record corresponds to one completed sale with its product-level utility lines embedded.',
  })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() query: FindUtilitiesDto) {
    return this.utilitiesService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get sale utility by ID (Owner / Admin / Collaborator)' })
  @ApiOkResponse({ description: 'SaleUtility with embedded SaleItemUtility lines.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.utilitiesService.findOne(id);
  }
}
