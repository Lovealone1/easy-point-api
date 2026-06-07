import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FinancialTransactionsService } from './financial-transactions.service.js';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto.js';
import { FindFinancialTransactionsDto } from './dto/find-financial-transactions.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiSecurity,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
  ApiConflictResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Financial Transactions')
@ApiBearerAuth()
@Controller('financial-transactions')
export class FinancialTransactionsController {
  constructor(private readonly financialTransactionsService: FinancialTransactionsService) {}

  // ── Global Admin ──────────────────────────────────────────────────────────

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() query: FindFinancialTransactionsDto) {
    return this.financialTransactionsService.findAll(query);
  }

  // ── Org routes ────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('financial_transactions:create')
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record a manual transaction / adjustment (Org Owner / Org Admin)',
    description:
      'Creates an atomic financial transaction and updates the bank account balance. ' +
      'Operational transactions (sales, purchases) are recorded internally by their own modules.',
  })
  @ApiCreatedResponse({ description: 'Transaction recorded successfully.' })
  @ApiConflictResponse({ description: 'Concurrent balance update — retry.' })
  @ApiUnprocessableEntityResponse({ description: 'Account is FROZEN or INACTIVE.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(@Body() dto: CreateFinancialTransactionDto) {
    return this.financialTransactionsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('financial_transactions:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List transactions paginated (Org Owner / Org Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() query: FindFinancialTransactionsDto) {
    return this.financialTransactionsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('financial_transactions:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get transaction by ID (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Record found.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.financialTransactionsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('financial_transactions:delete')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete a manual transaction / adjustment (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Transaction deleted and balance reverted successfully.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.financialTransactionsService.remove(id);
  }
}
