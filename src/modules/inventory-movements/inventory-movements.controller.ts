import {
  Controller, Get, Post, Body, UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { InventoryMovementsService } from './inventory-movements.service.js';
import { CreateAdjustmentMovementDto } from './dto/create-adjustment-movement.dto.js';
import { CreateWasteMovementDto } from './dto/create-waste-movement.dto.js';
import { CreateTestsMovementDto } from './dto/create-tests-movement.dto.js';
import { CreateProductionMovementDto } from './dto/create-production-movement.dto.js';
import { FindInventoryMovementsDto } from './dto/find-inventory-movements.dto.js';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity,
  ApiOkResponse, ApiCreatedResponse, ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role, GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Inventory Movements')
@ApiBearerAuth()
@Controller('inventory-movements')
export class InventoryMovementsController {
  constructor(private readonly inventoryMovementsService: InventoryMovementsService) {}

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindInventoryMovementsDto) {
    return this.inventoryMovementsService.findAll(findOptionsDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR, Role.USER)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List paginated (All Org roles)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() findOptionsDto: FindInventoryMovementsDto) {
    return this.inventoryMovementsService.findAll(findOptionsDto);
  }

  @Post('adjustment')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Adjustment Movement' })
  @ApiCreatedResponse({ description: 'Adjustment created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  createAdjustment(@CurrentUser('sub') userId: string, @Body() dto: CreateAdjustmentMovementDto) {
    return this.inventoryMovementsService.createAdjustment(userId, dto);
  }

  @Post('waste')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Waste Movement' })
  @ApiCreatedResponse({ description: 'Waste movement created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  createWaste(@CurrentUser('sub') userId: string, @Body() dto: CreateWasteMovementDto) {
    return this.inventoryMovementsService.createWaste(userId, dto);
  }

  @Post('tests')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Tests Movement' })
  @ApiCreatedResponse({ description: 'Tests movement created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  createTests(@CurrentUser('sub') userId: string, @Body() dto: CreateTestsMovementDto) {
    return this.inventoryMovementsService.createTests(userId, dto);
  }

  @Post('production')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Production Movement' })
  @ApiCreatedResponse({ description: 'Production movement created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  createProduction(@CurrentUser('sub') userId: string, @Body() dto: CreateProductionMovementDto) {
    return this.inventoryMovementsService.createProduction(userId, dto);
  }
}
