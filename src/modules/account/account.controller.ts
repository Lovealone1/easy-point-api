import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';
import { UsersService } from '../users/users.service.js';
import { RequestEmailOtpDto } from '../users/dto/request-email-otp.dto.js';
import { VerifyEmailOtpDto } from '../users/dto/verify-email-otp.dto.js';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto.js';

/**
 * Account settings: the routes a person uses on their own account, as opposed
 * to the ones an administrator uses on somebody else's.
 *
 * The logic is the same as `UsersController`'s — same service, same OTP flow —
 * but the id comes off the token instead of the path. That difference is the
 * whole authorisation model here: there is no id to tamper with, so a user can
 * only ever reach their own record.
 *
 * Not pinned with `@RequireSessionScope`: your account is your account whether
 * you are in the dashboard or in the administration console, and the
 * account-settings panel is reachable from both.
 */
@ApiTags('Account Settings')
@ApiBearerAuth()
@Controller('me')
@UseGuards(JwtAuthGuard)
@AllowWithoutSubscription()
export class AccountController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get my account details',
    description:
      'Name, phone number, email and role. `GET /auth/me` returns the same person plus their organizations and branding; this one is the narrow read the account-settings form needs.',
  })
  @ApiOkResponse({ description: 'Account details returned.' })
  getProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update my name and phone number',
    description: 'The email address is changed through the two routes below, not here.',
  })
  @ApiOkResponse({ description: 'Account details updated.' })
  updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateMyProfileDto) {
    return this.usersService.update(userId, dto);
  }

  @Post('email/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start changing my email address',
    description:
      'Sends a verification code to the NEW address. Sending it there rather than to the current one is the point: it proves the person actually controls the mailbox they are moving to, which is what the code is for.',
  })
  @ApiOkResponse({ description: 'Verification code sent to the new address.' })
  @ApiBadRequestResponse({ description: 'The new address matches the current one.' })
  @ApiConflictResponse({ description: 'That address already belongs to another account.' })
  requestEmailChange(@CurrentUser('sub') userId: string, @Body() dto: RequestEmailOtpDto) {
    return this.usersService.requestEmailOtp(userId, dto);
  }

  @Patch('email')
  @ApiOperation({
    summary: 'Confirm my new email address',
    description:
      'Verifies the code and moves the account to the new address. This signs the account out of every device in both applications: the address is part of the signed token, so a session minted under the old one would keep presenting it.',
  })
  @ApiOkResponse({ description: 'Email changed; every session was ended.' })
  @ApiBadRequestResponse({ description: 'The code is wrong or has expired.' })
  @ApiConflictResponse({ description: 'That address already belongs to another account.' })
  confirmEmailChange(@CurrentUser('sub') userId: string, @Body() dto: VerifyEmailOtpDto) {
    return this.usersService.verifyEmailOtp(userId, dto);
  }
}
