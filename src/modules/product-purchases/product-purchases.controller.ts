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
import { ProductPurchasesService } from './product-purchases.service.js';
import { CreateProductPurchaseDto } from './dto/create-product-purchase.dto.js';
import { CompleteProductPurchaseDto } from './dto/complete-product-purchase.dto.js';
import { AddItemsProductPurchaseDto } from './dto/add-items-product-purchase.dto.js';
import { FindProductPurchasesDto } from './dto/find-product-purchases.dto.js';
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

@ApiTags('Product Purchases')
@ApiBearerAuth()
@Controller('product-purchases')
export class ProductPurchasesController {
  constructor(private readonly productPurchasesService: ProductPurchasesService) {}

  // ── Global Admin ────────────────────────────────────────────────────────────

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'List all product purchases globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() query: FindProductPurchasesDto) {
    return this.productPurchasesService.findAll(query);
  }

  // ── Org routes ──────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a product purchase (Owner / Admin / Collaborator)',
    description:
      'Atomically records a product purchase for resale. ' +
      'Only products with isPurchased = true are allowed. ' +
      'PENDING = inserts movements + stock only. COMPLETED = also debits bank account.',
  })
  @ApiCreatedResponse({ description: 'Product purchase created successfully.' })
  @ApiBadRequestResponse({ description: 'bankAccountId required for COMPLETED, or non-purchasable product.' })
  @ApiConflictResponse({ description: 'Concurrent balance update — retry.' })
  @ApiUnprocessableEntityResponse({ description: 'Bank account is FROZEN or INACTIVE.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateProductPurchaseDto,
  ) {
    return this.productPurchasesService.create(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List product purchases paginated (Owner / Admin / Collaborator)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() query: FindProductPurchasesDto) {
    return this.productPurchasesService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get product purchase by ID (Owner / Admin / Collaborator)' })
  @ApiOkResponse({ description: 'Record found.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.productPurchasesService.findOne(id);
  }

  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Complete a PENDING purchase (Owner / Admin)',
    description:
      'Transitions a PENDING product purchase to COMPLETED. ' +
      'Debits the specified bank account atomically (OCC). ' +
      'Throws 409 if already COMPLETED or CANCELLED.',
  })
  @ApiOkResponse({ description: 'Purchase completed and bank account debited.' })
  @ApiNotFoundResponse({ description: 'Purchase not found.' })
  @ApiConflictResponse({ description: 'Purchase is not PENDING, or concurrent balance update.' })
  @ApiUnprocessableEntityResponse({ description: 'Bank account is FROZEN or INACTIVE.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  complete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CompleteProductPurchaseDto,
  ) {
    return this.productPurchasesService.complete(userId, id, dto);
  }

  @Patch(':id/items')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Add items to a PENDING purchase (Owner / Admin / Collaborator)',
    description:
      'Appends additional product lines to a PENDING purchase. ' +
      'Updates InventoryMovements and ProductStocks atomically. ' +
      'Throws 409 if the purchase is not PENDING.',
  })
  @ApiOkResponse({ description: 'Items added and stock updated.' })
  @ApiNotFoundResponse({ description: 'Purchase or product not found.' })
  @ApiConflictResponse({ description: 'Purchase is not PENDING.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  addItems(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: AddItemsProductPurchaseDto,
  ) {
    return this.productPurchasesService.addItems(userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel or Delete a product purchase (Owner / Admin)',
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
    return this.productPurchasesService.remove(userId, id);
  }
}
