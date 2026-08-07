import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { UserSubscriptionCategoriesService } from './user-subscription-categories.service.js';
import { CreateUserSubscriptionCategoryDto } from './dto/create-user-subscription-category.dto.js';
import { UpdateUserSubscriptionCategoryDto } from './dto/update-user-subscription-category.dto.js';
import { DeleteUserSubscriptionCategoryDto } from './dto/delete-user-subscription-category.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';

@ApiTags('Personal Space — Subscription Categories')
@Controller('me/subscription-categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@AllowWithoutSubscription()
export class UserSubscriptionCategoriesController {
  constructor(private readonly categoriesService: UserSubscriptionCategoriesService) {}

  @Get()
  @ApiOperation({
    summary: 'List the categories the user can choose from',
    description:
      'Seeded system categories (userId null, read-only) plus the ones the user created, in one ordered list.',
  })
  @ApiOkResponse({ description: 'Categories found.' })
  findAll(@CurrentUser('sub') userId: string) {
    return this.categoriesService.findAllForUser(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a personal category' })
  @ApiCreatedResponse({ description: 'Category created.' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateUserSubscriptionCategoryDto) {
    return this.categoriesService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update one of the user\'s own categories' })
  @ApiOkResponse({ description: 'Category updated.' })
  @ApiForbiddenResponse({ description: 'System categories cannot be modified.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateUserSubscriptionCategoryDto,
  ) {
    return this.categoriesService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete one of the user\'s own categories',
    description:
      'A category in use requires `reassignTo` so its subscriptions are moved rather than silently left uncategorized.',
  })
  @ApiOkResponse({ description: 'Category deleted.' })
  @ApiForbiddenResponse({ description: 'System categories cannot be deleted.' })
  @ApiConflictResponse({ description: 'Category is in use and no reassignTo was given.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  remove(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Query() query: DeleteUserSubscriptionCategoryDto,
  ) {
    return this.categoriesService.remove(id, userId, query.reassignTo);
  }
}
