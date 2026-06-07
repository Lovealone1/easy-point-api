import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DiscountRulesService } from './discount-rules.service.js';
import { CreateDiscountRuleDto } from './dto/create-discount-rule.dto.js';
import { UpdateDiscountRuleDto } from './dto/update-discount-rule.dto.js';
import { FindDiscountRulesDto } from './dto/find-discount-rules.dto.js';
import { ToggleDiscountRuleActiveDto } from './dto/toggle-discount-rule-active.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiSecurity,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Discount Rules')
@ApiBearerAuth()
@Controller('discount-rules')
export class DiscountRulesController {
  constructor(private readonly discountRulesService: DiscountRulesService) {}

  // --- RUTA GLOBAL ADMIN (declarada antes de :id) ---

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all discount rules globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() query: FindDiscountRulesDto) {
    return this.discountRulesService.findAll(query);
  }

  // --- RUTAS DE ORGANIZACIÓN ---

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('discount_rules:create')
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a discount rule (Org Owner / Org Admin)',
    description:
      'El campo `code` se genera automáticamente si no se provee. ' +
      'Para scope CLIENT, `clientId` es obligatorio.',
  })
  @ApiCreatedResponse({ description: 'Discount rule created successfully.' })
  @ApiConflictResponse({ description: 'Code already exists in this organization.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(
    @Body() dto: CreateDiscountRuleDto, 
    @CurrentUser('sub') userId: string
  ) {
    return this.discountRulesService.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('discount_rules:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List discount rules paginated (Org Owner / Org Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() query: FindDiscountRulesDto) {
    return this.discountRulesService.findAll(query);
  }

  @Get('by-code/:code')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('discount_rules:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Find a discount rule by code (Org Owner / Org Admin)',
    description: 'Útil para aplicar un descuento por su código al registrar una venta.',
  })
  @ApiOkResponse({ description: 'Discount rule found.' })
  @ApiNotFoundResponse({ description: 'No rule found with this code in this organization.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findByCode(@Param('code') code: string) {
    return this.discountRulesService.findByCode(code);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('discount_rules:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get discount rule by ID (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Discount rule found.' })
  @ApiNotFoundResponse({ description: 'Discount rule not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.discountRulesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('discount_rules:update')
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Update discount rule (Org Owner / Org Admin)',
    description: 'Los campos `type` y `scope` no son modificables una vez creados.',
  })
  @ApiOkResponse({ description: 'Discount rule updated successfully.' })
  @ApiNotFoundResponse({ description: 'Discount rule not found.' })
  @ApiConflictResponse({ description: 'New code already exists in this organization.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(@Param('id') id: string, @Body() dto: UpdateDiscountRuleDto) {
    return this.discountRulesService.update(id, dto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('discount_rules:update')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Toggle active status (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Status updated.' })
  @ApiNotFoundResponse({ description: 'Discount rule not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  toggleActive(
    @Param('id') id: string,
    @Body() dto: ToggleDiscountRuleActiveDto,
  ) {
    return this.discountRulesService.toggleActive(id, dto.isActive);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('discount_rules:delete')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete discount rule (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Discount rule deleted.' })
  @ApiNotFoundResponse({ description: 'Discount rule not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.discountRulesService.remove(id);
  }
}
