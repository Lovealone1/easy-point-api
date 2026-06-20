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
} from '@nestjs/common';
import { ExpenseCategoriesService } from './expense-categories.service.js';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto.js';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto.js';
import { FindExpenseCategoriesDto } from './dto/find-expense-categories.dto.js';
import { ToggleExpenseCategoryActiveDto } from './dto/toggle-expense-category-active.dto.js';
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
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Expense Categories')
@ApiBearerAuth()
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(private readonly expenseCategoriesService: ExpenseCategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('expense_categories:create')
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create expense category (Org Owner / Org Admin)' })
  @ApiCreatedResponse({ description: 'Category created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(@Body() createDto: CreateExpenseCategoryDto) {
    return this.expenseCategoriesService.create(createDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('expense_categories:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List expense categories paginated (Org Owner / Org Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() query: FindExpenseCategoriesDto) {
    return this.expenseCategoriesService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('expense_categories:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get expense category by ID (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Category found.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.expenseCategoriesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('expense_categories:update')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Update expense category (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Category updated successfully.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateExpenseCategoryDto,
  ) {
    return this.expenseCategoriesService.update(id, updateDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('expense_categories:update')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Toggle active status (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Status updated.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  toggleActive(
    @Param('id') id: string,
    @Body() toggleDto: ToggleExpenseCategoryActiveDto,
  ) {
    return this.expenseCategoriesService.toggleActive(id, toggleDto.isActive);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('expense_categories:delete')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete expense category (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Category deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.expenseCategoriesService.remove(id);
  }
}
