import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TransactionCategoriesService } from './transaction-categories.service.js';
import { CreateTransactionCategoryDto } from './dto/create-transaction-category.dto.js';
import { UpdateTransactionCategoryDto } from './dto/update-transaction-category.dto.js';
import { FindTransactionCategoriesDto } from './dto/find-transaction-categories.dto.js';
import { ToggleTransactionCategoryActiveDto } from './dto/toggle-transaction-category-active.dto.js';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role, GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Transaction Categories')
@ApiBearerAuth()
@Controller('transaction-categories')
export class TransactionCategoriesController {
  constructor(private readonly transactionCategoriesService: TransactionCategoriesService) {}

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindTransactionCategoriesDto) {
    return this.transactionCategoriesService.findAll(findOptionsDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create (Org Owner / Org Admin)' })
  @ApiCreatedResponse({ description: 'Created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(@Body() createTransactionCategoryDto: CreateTransactionCategoryDto) {
    return this.transactionCategoriesService.create(createTransactionCategoryDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR, Role.USER)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List paginated (All Org Roles)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() findOptionsDto: FindTransactionCategoriesDto) {
    return this.transactionCategoriesService.findAll(findOptionsDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR, Role.USER)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get by ID (All Org Roles)' })
  @ApiOkResponse({ description: 'Record found.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.transactionCategoriesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Update (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Updated successfully.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(@Param('id') id: string, @Body() updateTransactionCategoryDto: UpdateTransactionCategoryDto) {
    return this.transactionCategoriesService.update(id, updateTransactionCategoryDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Toggle active status (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Status updated.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  toggleActive(@Param('id') id: string, @Body() toggleDto: ToggleTransactionCategoryActiveDto) {
    return this.transactionCategoriesService.toggleActive(id, toggleDto.isActive);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.transactionCategoriesService.remove(id);
  }
}
