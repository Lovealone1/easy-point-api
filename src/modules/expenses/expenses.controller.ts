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
import { ExpensesService } from './expenses.service.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { UpdateExpenseDto } from './dto/update-expense.dto.js';
import { FindExpensesDto } from './dto/find-expenses.dto.js';
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
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('expenses:create')
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new expense (Org Owner / Org Admin)' })
  @ApiCreatedResponse({ description: 'Expense registered successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(
    @CurrentUser('sub') userId: string,
    @Body() createDto: CreateExpenseDto,
  ) {
    return this.expensesService.create(userId, createDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('expenses:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List expenses paginated (Org Owner / Org Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() query: FindExpensesDto) {
    return this.expensesService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('expenses:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get expense by ID (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Expense found.' })
  @ApiNotFoundResponse({ description: 'Expense not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('expenses:update')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Update expense metadata (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Expense updated successfully.' })
  @ApiNotFoundResponse({ description: 'Expense not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('expenses:delete')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete expense and refund balance (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Expense deleted and refunded successfully.' })
  @ApiNotFoundResponse({ description: 'Expense not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.remove(userId, id);
  }
}
