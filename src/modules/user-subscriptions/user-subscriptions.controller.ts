import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UserSubscriptionsService } from './user-subscriptions.service.js';
import { CreateUserSubscriptionDto } from './dto/create-user-subscription.dto.js';
import { UpdateUserSubscriptionDto } from './dto/update-user-subscription.dto.js';
import { UpdateUserSubscriptionStatusDto } from './dto/update-user-subscription-status.dto.js';
import { FindUserSubscriptionsDto } from './dto/find-user-subscriptions.dto.js';
import { GetSubscriptionsSummaryDto } from './dto/get-subscriptions-summary.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Personal Space — Subscriptions')
@Controller('me/subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@AllowWithoutSubscription()
export class UserSubscriptionsController {
  constructor(private readonly subscriptionsService: UserSubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user\'s digital subscriptions (paginated)' })
  @ApiOkResponse({ type: PageDto })
  findAll(@Query() query: FindUserSubscriptionsDto, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.findAllForUser(userId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Spending summary across cards and categories' })
  @ApiOkResponse({ description: 'Summary computed.' })
  getSummary(@Query() query: GetSubscriptionsSummaryDto, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.getSummary(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subscription by ID' })
  @ApiOkResponse({ description: 'Subscription found.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.findOneForUser(id, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new digital subscription' })
  @ApiCreatedResponse({ description: 'Subscription successfully created.' })
  @ApiBadRequestResponse({ description: 'Invalid payload.' })
  create(@Body() dto: CreateUserSubscriptionDto, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a subscription' })
  @ApiOkResponse({ description: 'Subscription successfully updated.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateUserSubscriptionDto, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.update(id, userId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change subscription status (active/paused/cancelled)' })
  @ApiOkResponse({ description: 'Status updated.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserSubscriptionStatusDto, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.updateStatus(id, userId, dto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subscription' })
  @ApiOkResponse({ description: 'Subscription successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.remove(id, userId);
  }
}
