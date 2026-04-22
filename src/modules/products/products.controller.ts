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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { generateEan13Png } from '../../common/utils/barcode.util.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { FindProductsDto } from './dto/find-products.dto.js';
import { ToggleProductActiveDto } from './dto/toggle-product-active.dto.js';
import { AddProductNoteDto } from './dto/add-product-note.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiSecurity,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role, GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // --- RUTA GLOBAL ADMIN (declarada antes de :id) ---

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all products globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindProductsDto) {
    return this.productsService.findAll(findOptionsDto);
  }

  // --- RUTAS DE ORGANIZACIÓN ---

  @Post()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create product (Org Owner / Org Admin)',
    description:
      'Si no se proporciona `sku`, se genera automáticamente con el formato ORG-CAT-PRD-0000.',
  })
  @ApiCreatedResponse({ description: 'Product created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List products paginated (Org Owner / Org Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() findOptionsDto: FindProductsDto) {
    return this.productsService.findAll(findOptionsDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get product by ID (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Product found.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get(':id/barcode')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Get product barcode as PNG (Org Owner / Org Admin)',
    description:
      'Devuelve la imagen PNG del código de barras EAN-13 del producto para imprimir o mostrar.',
  })
  @ApiOkResponse({ description: 'PNG del barcode EAN-13.', content: { 'image/png': {} } })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async getBarcode(@Param('id') id: string, @Res() res: Response) {
    const product = await this.productsService.findOne(id);
    if (!product.barcode) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }
    const png = await generateEan13Png(product.barcode);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${product.sku ?? product.id}.png"`);
    return res.send(png);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Update product (Org Owner / Org Admin)',
    description: 'El SKU no puede modificarse desde este endpoint.',
  })
  @ApiOkResponse({ description: 'Product updated successfully.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Toggle active status (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Status updated.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  toggleActive(
    @Param('id') id: string,
    @Body() toggleDto: ToggleProductActiveDto,
  ) {
    return this.productsService.toggleActive(id, toggleDto.isActive);
  }

  @Post(':id/notes')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add note to product (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Note appended.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  addNote(@Param('id') id: string, @Body() noteDto: AddProductNoteDto) {
    return this.productsService.addNote(id, noteDto.notes);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete product (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Product deleted.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
