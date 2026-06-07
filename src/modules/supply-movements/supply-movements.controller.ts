import {
  Controller, Get, Post, Body, UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SupplyMovementsService } from './supply-movements.service.js';
import { CreateSupplyPurchaseMovementDto } from './dto/create-supply-purchase-movement.dto.js';
import { CreateSupplyProductionMovementDto } from './dto/create-supply-production-movement.dto.js';
import { FindSupplyMovementsDto } from './dto/find-supply-movements.dto.js';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity,
  ApiOkResponse, ApiCreatedResponse, ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Supply Movements')
@ApiBearerAuth()
@Controller('supply-movements')
export class SupplyMovementsController {
  constructor(private readonly supplyMovementsService: SupplyMovementsService) {}

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindSupplyMovementsDto) {
    return this.supplyMovementsService.findAll(findOptionsDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('supply_movements:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List paginated (All Org roles)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() findOptionsDto: FindSupplyMovementsDto) {
    return this.supplyMovementsService.findAll(findOptionsDto);
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('supply_movements:adjust')
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Purchase Movement' })
  @ApiCreatedResponse({ description: 'Purchase movement created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  createPurchase(@CurrentUser('sub') userId: string, @Body() dto: CreateSupplyPurchaseMovementDto) {
    return this.supplyMovementsService.createPurchase(userId, dto);
  }

  @Post('production')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('supply_movements:adjust')
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Production Movement' })
  @ApiCreatedResponse({ description: 'Production movement created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  createProduction(@CurrentUser('sub') userId: string, @Body() dto: CreateSupplyProductionMovementDto) {
    return this.supplyMovementsService.createProduction(userId, dto);
  }
}
