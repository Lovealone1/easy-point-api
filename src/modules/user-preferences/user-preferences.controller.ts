import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { UserPreferencesService } from './user-preferences.service.js';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';

@ApiTags('Personal Space — Preferences')
@Controller('me/preferences')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@AllowWithoutSubscription()
export class UserPreferencesController {
  constructor(private readonly preferencesService: UserPreferencesService) {}

  @Get()
  @ApiOperation({
    summary: "Get the current user's personal-space preferences",
    description: 'Creates the row with defaults the first time it is read.',
  })
  @ApiOkResponse({ description: 'Preferences found.' })
  findMine(@CurrentUser('sub') userId: string) {
    return this.preferencesService.findForUser(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update timezone, preferred currency, goal and reminder settings' })
  @ApiOkResponse({ description: 'Preferences updated.' })
  @ApiBadRequestResponse({ description: 'Invalid timezone or currency code.' })
  update(@CurrentUser('sub') userId: string, @Body() dto: UpdateUserPreferencesDto) {
    return this.preferencesService.update(userId, dto);
  }
}
