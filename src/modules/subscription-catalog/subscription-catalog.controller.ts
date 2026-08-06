import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Query, HttpCode, HttpStatus, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubscriptionCatalogService } from './subscription-catalog.service.js';
import { CreateSubscriptionCategoryDto } from './dto/create-subscription-category.dto.js';
import { UpdateSubscriptionCategoryDto } from './dto/update-subscription-category.dto.js';
import { CreateSubscriptionProviderDto } from './dto/create-subscription-provider.dto.js';
import { UpdateSubscriptionProviderDto } from './dto/update-subscription-provider.dto.js';
import { FindSubscriptionProvidersDto } from './dto/find-subscription-providers.dto.js';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';

@ApiTags('Subscription Catalog')
@Controller('subscription-catalog')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@AllowWithoutSubscription()
export class SubscriptionCatalogController {
  constructor(private readonly catalogService: SubscriptionCatalogService) {}

  // Categories

  @Get('categories')
  @ApiOperation({ summary: 'List subscription categories' })
  @ApiOkResponse({ description: 'Categories found.' })
  findAllCategories(@Query('isActive') isActive?: string) {
    const parsed = isActive === undefined ? undefined : isActive === 'true';
    return this.catalogService.findAllCategories(parsed);
  }

  @Post('categories')
  @UseGuards(RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a subscription category (Admin Only)' })
  @ApiCreatedResponse({ description: 'Category successfully created.' })
  @ApiBadRequestResponse({ description: 'Invalid payload or duplicate key.' })
  createCategory(@Body() dto: CreateSubscriptionCategoryDto) {
    return this.catalogService.createCategory(dto);
  }

  @Patch('categories/:id')
  @UseGuards(RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Update a subscription category (Admin Only)' })
  @ApiOkResponse({ description: 'Category successfully updated.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateSubscriptionCategoryDto) {
    return this.catalogService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Delete a subscription category (Admin Only)' })
  @ApiOkResponse({ description: 'Category successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  removeCategory(@Param('id') id: string) {
    return this.catalogService.removeCategory(id);
  }

  // Providers

  @Get('providers')
  @ApiOperation({ summary: 'List subscription providers (paginated)' })
  @ApiOkResponse({ type: PageDto })
  findAllProviders(@Query() query: FindSubscriptionProvidersDto) {
    return this.catalogService.findAllProviders(query);
  }

  @Get('providers/:id')
  @ApiOperation({ summary: 'Get provider details by ID' })
  @ApiOkResponse({ description: 'Provider found.' })
  @ApiNotFoundResponse({ description: 'Provider not found.' })
  findOneProvider(@Param('id') id: string) {
    return this.catalogService.findOneProvider(id);
  }

  @Post('providers')
  @UseGuards(RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a subscription provider (Admin Only)' })
  @ApiCreatedResponse({ description: 'Provider successfully created.' })
  @ApiBadRequestResponse({ description: 'Invalid payload or duplicate key.' })
  createProvider(@Body() dto: CreateSubscriptionProviderDto) {
    return this.catalogService.createProvider(dto);
  }

  @Patch('providers/:id')
  @UseGuards(RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Update a subscription provider (Admin Only)' })
  @ApiOkResponse({ description: 'Provider successfully updated.' })
  @ApiNotFoundResponse({ description: 'Provider not found.' })
  updateProvider(@Param('id') id: string, @Body() dto: UpdateSubscriptionProviderDto) {
    return this.catalogService.updateProvider(id, dto);
  }

  @Delete('providers/:id')
  @UseGuards(RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Delete a subscription provider (Admin Only)' })
  @ApiOkResponse({ description: 'Provider successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Provider not found.' })
  removeProvider(@Param('id') id: string) {
    return this.catalogService.removeProvider(id);
  }

  @Post('providers/:id/logo')
  @UseGuards(RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a logo for a subscription provider (Admin Only)' })
  @ApiOkResponse({ description: 'Logo uploaded.' })
  @ApiNotFoundResponse({ description: 'Provider not found.' })
  uploadProviderLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.catalogService.uploadProviderLogo(id, file);
  }
}
