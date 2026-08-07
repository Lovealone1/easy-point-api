import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { UserPreferencesService } from './user-preferences.service.js';
import { UpdateOnboardingGoalDto } from './dto/update-onboarding-goal.dto.js';
import { UpdateOnboardingRegionDto } from './dto/update-onboarding-region.dto.js';
import { UpdateReminderPreferencesDto } from './dto/update-reminder-preferences.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';

@ApiTags('Personal Space — Onboarding')
@Controller('me/onboarding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@AllowWithoutSubscription()
export class OnboardingController {
  constructor(private readonly preferencesService: UserPreferencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the onboarding state so the wizard can resume',
    description: 'Step progress is monotonic — editing an earlier answer never rewinds the wizard.',
  })
  @ApiOkResponse({ description: 'Onboarding state found.' })
  getState(@CurrentUser('sub') userId: string) {
    return this.preferencesService.getState(userId);
  }

  @Get('goals')
  @ApiOperation({ summary: 'List the fixed pool of onboarding goals' })
  @ApiOkResponse({ description: 'Goals found.' })
  getGoals() {
    return this.preferencesService.getGoalOptions();
  }

  @Patch('goal')
  @ApiOperation({ summary: "Set the user's goal and advance to the region step" })
  @ApiOkResponse({ description: 'Goal saved.' })
  setGoal(@CurrentUser('sub') userId: string, @Body() dto: UpdateOnboardingGoalDto) {
    return this.preferencesService.setGoal(userId, dto);
  }

  @Patch('region')
  @ApiOperation({ summary: 'Set timezone and preferred currency, then advance to reminders' })
  @ApiOkResponse({ description: 'Region saved.' })
  @ApiBadRequestResponse({ description: 'Invalid timezone or currency code.' })
  setRegion(@CurrentUser('sub') userId: string, @Body() dto: UpdateOnboardingRegionDto) {
    return this.preferencesService.setRegion(userId, dto);
  }

  @Patch('reminders')
  @ApiOperation({
    summary: 'Set reminder preferences and finish the wizard steps',
    description: 'Persisted for the wizard to round-trip; the notification pipeline is still a mock.',
  })
  @ApiOkResponse({ description: 'Reminder preferences saved.' })
  setReminders(@CurrentUser('sub') userId: string, @Body() dto: UpdateReminderPreferencesDto) {
    return this.preferencesService.setReminders(userId, dto);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark onboarding as completed' })
  @ApiOkResponse({ description: 'Onboarding completed.' })
  complete(@CurrentUser('sub') userId: string) {
    return this.preferencesService.complete(userId);
  }
}
