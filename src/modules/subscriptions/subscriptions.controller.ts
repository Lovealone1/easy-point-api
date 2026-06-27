import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto.js';
import { FindSubscriptionsDto } from './dto/find-subscriptions.dto.js';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiTooManyRequestsResponse, ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new subscription for an organization (Admin Only)' })
  @ApiCreatedResponse({ description: 'Subscription successfully created.' })
  @ApiBadRequestResponse({ description: 'Invalid payload or inactive plan/missing org.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(
    @CurrentUser('sub') userId: string,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.create(userId, createSubscriptionDto);
  }

  @Get()
  @ApiOperation({ summary: 'List subscriptions paginated (Admin Only)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() query: FindSubscriptionsDto) {
    return this.subscriptionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription details by ID (Admin Only)' })
  @ApiOkResponse({ description: 'Subscription found.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.subscriptionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update subscription details (Admin Only)' })
  @ApiOkResponse({ description: 'Subscription successfully updated.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionsService.update(id, updateSubscriptionDto, userId);
  }

  @Patch(':id/pause')
  @ApiOperation({ summary: 'Pause a subscription (Admin Only)' })
  @ApiOkResponse({ description: 'Subscription successfully paused.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  pause(@Param('id') id: string) {
    return this.subscriptionsService.pause(id);
  }

  @Patch(':id/resume')
  @ApiOperation({ summary: 'Resume a paused subscription (Admin Only)' })
  @ApiOkResponse({ description: 'Subscription successfully resumed.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  resume(@Param('id') id: string) {
    return this.subscriptionsService.resume(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a subscription (Admin Only)' })
  @ApiOkResponse({ description: 'Subscription successfully cancelled.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  cancel(@Param('id') id: string) {
    return this.subscriptionsService.cancel(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subscription (Admin Only)' })
  @ApiOkResponse({ description: 'Subscription successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.subscriptionsService.remove(id);
  }
}
