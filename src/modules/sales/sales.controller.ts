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
import { SalesService } from './sales.service.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { CompleteSaleDto } from './dto/complete-sale.dto.js';
import { AddItemsSaleDto } from './dto/add-items-sale.dto.js';
import { FindSalesDto } from './dto/find-sales.dto.js';
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

@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ── Global Admin ────────────────────────────────────────────────────────────

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'List all sales globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() query: FindSalesDto) {
    return this.salesService.findAll(query);
  }

  // ── Org routes ──────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a sale (Owner / Admin / Collaborator)',
    description:
      'Atomically records a sale. ' +
      'PENDING = decrements stock only (quote / pending dispatch). ' +
      'COMPLETED = decrements stock + credits the bank account. ' +
      'paymentMethod is required when status = COMPLETED.',
  })
  @ApiCreatedResponse({ description: 'Sale created successfully.' })
  @ApiBadRequestResponse({ description: 'bankAccountId or paymentMethod missing for COMPLETED, or invalid product.' })
  @ApiUnprocessableEntityResponse({ description: 'Insufficient stock or bank account is FROZEN/INACTIVE.' })
  @ApiConflictResponse({ description: 'Concurrent balance update — retry.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSaleDto,
  ) {
    return this.salesService.create(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List sales paginated (Owner / Admin / Collaborator)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() query: FindSalesDto) {
    return this.salesService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get sale by ID (Owner / Admin / Collaborator)' })
  @ApiOkResponse({ description: 'Record found.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Complete a PENDING sale / dispatch a quote (Owner / Admin)',
    description:
      'Transitions a PENDING sale to COMPLETED. ' +
      'Credits the specified bank account atomically (OCC). ' +
      'paymentMethod is required for financial traceability. ' +
      'Throws 409 if already COMPLETED or CANCELLED.',
  })
  @ApiOkResponse({ description: 'Sale completed and bank account credited.' })
  @ApiNotFoundResponse({ description: 'Sale not found.' })
  @ApiConflictResponse({ description: 'Sale is not PENDING, or concurrent balance update.' })
  @ApiUnprocessableEntityResponse({ description: 'Bank account is FROZEN or INACTIVE.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  complete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CompleteSaleDto,
  ) {
    return this.salesService.complete(userId, id, dto);
  }

  @Patch(':id/items')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Add items to a PENDING sale / quote (Owner / Admin / Collaborator)',
    description:
      'Appends additional product lines to a PENDING sale. ' +
      'Decrements stock and updates totalAmount atomically. ' +
      'Throws 409 if the sale is not PENDING.',
  })
  @ApiOkResponse({ description: 'Items added and stock decremented.' })
  @ApiNotFoundResponse({ description: 'Sale or product stock not found.' })
  @ApiConflictResponse({ description: 'Sale is not PENDING.' })
  @ApiUnprocessableEntityResponse({ description: 'Insufficient stock.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  addItems(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: AddItemsSaleDto,
  ) {
    return this.salesService.addItems(userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel or Delete a sale (Owner / Admin)',
    description:
      'PENDING: Restores stock, deletes movements, hard-deletes the sale. ' +
      'COMPLETED: Restores stock, deletes movements, creates a DEBIT reversal transaction, marks sale as CANCELLED.',
  })
  @ApiOkResponse({ description: 'Sale cancelled/deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Sale not found.' })
  @ApiConflictResponse({ description: 'Sale is already cancelled or missing financial tx.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.salesService.remove(userId, id);
  }
}
