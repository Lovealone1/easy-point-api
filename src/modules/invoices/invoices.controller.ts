import {
  Controller, Get, Post, Body, Param, Delete,
  UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { FindInvoicesDto } from './dto/find-invoices.dto.js';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiTooManyRequestsResponse, ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create/Register a payment/invoice for a subscription (Admin Only)' })
  @ApiCreatedResponse({ description: 'Invoice successfully registered.' })
  @ApiBadRequestResponse({ description: 'Invalid payload or subscription paused.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices paginated (Admin Only)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() query: FindInvoicesDto) {
    return this.invoicesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice details by ID (Admin Only)' })
  @ApiOkResponse({ description: 'Invoice found.' })
  @ApiNotFoundResponse({ description: 'Invoice not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Void an invoice (Admin Only)' })
  @ApiOkResponse({ description: 'Invoice successfully voided.' })
  @ApiNotFoundResponse({ description: 'Invoice not found.' })
  @ApiBadRequestResponse({ description: 'Invoice already paid or voided.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
