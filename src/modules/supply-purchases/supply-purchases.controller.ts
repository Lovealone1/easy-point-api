import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SupplyPurchasesService } from './supply-purchases.service.js';
import { CreateSupplyPurchaseDto } from './dto/create-supply-purchase.dto.js';
import { CompleteSupplyPurchaseDto } from './dto/complete-supply-purchase.dto.js';
import { AddItemsSupplyPurchaseDto } from './dto/add-items-supply-purchase.dto.js';
import { FindSupplyPurchasesDto } from './dto/find-supply-purchases.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiSecurity,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiUnprocessableEntityResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role, GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Supply Purchases')
@ApiBearerAuth()
@Controller('supply-purchases')
export class SupplyPurchasesController {
  constructor(private readonly supplyPurchasesService: SupplyPurchasesService) {}

  // ── Global Admin ────────────────────────────────────────────────────────────

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'List all supply purchases globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() query: FindSupplyPurchasesDto) {
    return this.supplyPurchasesService.findAll(query);
  }

  // ── Org routes ──────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a supply purchase (Owner / Admin / Collaborator)',
    description:
      'Atomically records a supply purchase. ' +
      'If status=PENDING: inserts purchase header + movements + stock updates (no financial debit). ' +
      'If status=COMPLETED: additionally debits the specified bank account.',
  })
  @ApiCreatedResponse({ description: 'Supply purchase created successfully.' })
  @ApiBadRequestResponse({ description: 'bankAccountId required when status=COMPLETED, or invalid stock/supply pairing.' })
  @ApiConflictResponse({ description: 'Concurrent balance update — retry.' })
  @ApiUnprocessableEntityResponse({ description: 'Bank account is FROZEN or INACTIVE.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSupplyPurchaseDto,
  ) {
    return this.supplyPurchasesService.create(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List supply purchases paginated (Owner / Admin / Collaborator)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() query: FindSupplyPurchasesDto) {
    return this.supplyPurchasesService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get supply purchase by ID (Owner / Admin / Collaborator)' })
  @ApiOkResponse({ description: 'Record found.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.supplyPurchasesService.findOne(id);
  }

  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Complete a PENDING purchase (Owner / Admin)',
    description:
      'Transitions a PENDING supply purchase to COMPLETED. ' +
      'Debits the specified bank account atomically (OCC). ' +
      'Throws 409 if the purchase is already COMPLETED or CANCELLED.',
  })
  @ApiOkResponse({ description: 'Purchase completed and bank account debited.' })
  @ApiNotFoundResponse({ description: 'Purchase not found.' })
  @ApiConflictResponse({ description: 'Purchase is not PENDING, or concurrent balance update.' })
  @ApiUnprocessableEntityResponse({ description: 'Bank account is FROZEN or INACTIVE.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  complete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CompleteSupplyPurchaseDto,
  ) {
    return this.supplyPurchasesService.complete(userId, id, dto);
  }

  @Patch(':id/items')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Add items to a PENDING purchase (Owner / Admin / Collaborator)',
    description:
      'Appends additional supply lines to a PENDING purchase. ' +
      'Updates SupplyMovements and SupplyStocks atomically. ' +
      'Throws 409 if the purchase is not PENDING.',
  })
  @ApiOkResponse({ description: 'Items added and stock updated.' })
  @ApiNotFoundResponse({ description: 'Purchase or stock not found.' })
  @ApiConflictResponse({ description: 'Purchase is not PENDING.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  addItems(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: AddItemsSupplyPurchaseDto,
  ) {
    return this.supplyPurchasesService.addItems(userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel or Delete a supply purchase (Owner / Admin)',
    description:
      'If PENDING: Deletes the purchase and reverses stock increments. ' +
      'If COMPLETED: Reverses stock, creates a CREDIT financial transaction (Refund), and marks purchase as CANCELLED.',
  })
  @ApiOkResponse({ description: 'Purchase cancelled/deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Purchase not found.' })
  @ApiConflictResponse({ description: 'Purchase is already cancelled or missing financial tx.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.supplyPurchasesService.remove(userId, id);
  }
}
