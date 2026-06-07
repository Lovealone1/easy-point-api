import {
  Controller, Get, Post, Body, Param, UseGuards, Query, HttpCode, HttpStatus, Patch,
} from '@nestjs/common';
import { ProductStocksService } from './product-stocks.service.js';
import { CreateProductStockDto } from './dto/create-product-stock.dto.js';
import { FindProductStocksDto } from './dto/find-product-stocks.dto.js';
import { UpdateProductStockDto } from './dto/update-product-stock.dto.js';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Product Stocks')
@ApiBearerAuth()
@Controller('product-stocks')
export class ProductStocksController {
  constructor(private readonly productStocksService: ProductStocksService) {}

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindProductStocksDto) {
    return this.productStocksService.findAll(findOptionsDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('product_stocks:update')
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a product in stock (initializes at 0)' })
  @ApiCreatedResponse({ description: 'Created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(@Body() createProductStockDto: CreateProductStockDto) {
    return this.productStocksService.create(createProductStockDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('product_stocks:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List paginated (Owner / Admin / Collaborator)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() findOptionsDto: FindProductStocksDto) {
    return this.productStocksService.findAll(findOptionsDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('product_stocks:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get by ID (Owner / Admin / Collaborator)' })
  @ApiOkResponse({ description: 'Record found.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.productStocksService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('product_stocks:update')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Update product stock record' })
  @ApiOkResponse({ description: 'Updated successfully.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(@Param('id') id: string, @Body() updateProductStockDto: UpdateProductStockDto) {
    return this.productStocksService.update(id, updateProductStockDto);
  }
}
