import {
  Controller, Get, Post, Put, Body, Patch, Param, Delete, UseGuards, Query, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserSubscriptionsService } from './user-subscriptions.service.js';
import { CreateUserSubscriptionDto } from './dto/create-user-subscription.dto.js';
import { UpdateUserSubscriptionDto } from './dto/update-user-subscription.dto.js';
import { UpdateUserSubscriptionStatusDto } from './dto/update-user-subscription-status.dto.js';
import { FindUserSubscriptionsDto } from './dto/find-user-subscriptions.dto.js';
import { GetSubscriptionsSummaryDto } from './dto/get-subscriptions-summary.dto.js';
import { LogUsageCheckinDto } from './dto/log-usage-checkin.dto.js';
import { FindUsageCheckinsDto } from './dto/find-usage-checkins.dto.js';
import { GetCashFlowCalendarDto } from './dto/get-cash-flow-calendar.dto.js';
import { UploadSubscriptionLogoDto } from './dto/upload-subscription-logo.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiBadRequestResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
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

  // NOTE: static routes must be declared before ':id' — Nest/Express would
  // otherwise match 'summary', 'zombies', 'cash-flow-calendar' as an :id param.

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

  @Get('zombies')
  @ApiOperation({ summary: 'Active subscriptions with low usage — candidates to cancel' })
  @ApiOkResponse({ description: 'Zombie candidates computed.' })
  getZombieCandidates(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.getZombieCandidates(userId);
  }

  @Get('cash-flow-calendar')
  @ApiOperation({ summary: 'Projected charges for a month, grouped by day and by card billing cycle' })
  @ApiOkResponse({ description: 'Calendar computed.' })
  getCashFlowCalendar(@Query() query: GetCashFlowCalendarDto, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.getCashFlowCalendar(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subscription by ID' })
  @ApiOkResponse({ description: 'Subscription found.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.getDetailForUser(id, userId);
  }

  @Get(':id/price-history')
  @ApiOperation({ summary: 'Price change history for a subscription' })
  @ApiOkResponse({ description: 'History found.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  getPriceHistory(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.getPriceHistory(id, userId);
  }

  @Get(':id/usage-checkins')
  @ApiOperation({ summary: 'Raw usage check-in log for a subscription' })
  @ApiOkResponse({ description: 'Check-ins found.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  getUsageCheckins(@Param('id') id: string, @Query() query: FindUsageCheckinsDto, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.getUsageCheckins(id, userId, query);
  }

  @Get(':id/usage-stats')
  @ApiOperation({ summary: 'Derived usage rate and zombie-candidate flag for a subscription' })
  @ApiOkResponse({ description: 'Stats computed.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  getUsageStats(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.getUsageStats(id, userId);
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

  @Put(':id/usage-checkins')
  @ApiOperation({ summary: 'Log (or correct) a daily usage check-in for a subscription' })
  @ApiOkResponse({ description: 'Check-in saved.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  logUsageCheckin(@Param('id') id: string, @Body() dto: LogUsageCheckinDto, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.logUsageCheckin(id, userId, dto);
  }

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Logo file (PNG, JPG, WEBP, SVG — máx. 2 MB)', type: UploadSubscriptionLogoDto })
  @ApiOperation({
    summary: 'Upload a logo for a custom subscription',
    description: 'Only for custom subscriptions; catalog-backed ones use the provider logo.',
  })
  @ApiOkResponse({ description: 'Logo uploaded.' })
  @ApiBadRequestResponse({ description: 'Catalog-backed subscription, unsupported format, or file too large.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('sub') userId: string,
  ) {
    return this.subscriptionsService.uploadLogo(id, userId, file);
  }

  @Delete(':id/logo')
  @ApiOperation({ summary: 'Remove the custom logo of a subscription' })
  @ApiOkResponse({ description: 'Logo removed.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  deleteLogo(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.deleteLogo(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subscription' })
  @ApiOkResponse({ description: 'Subscription successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Subscription not found.' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.subscriptionsService.remove(id, userId);
  }
}
