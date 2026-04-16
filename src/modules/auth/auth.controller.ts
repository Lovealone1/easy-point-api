import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get, Delete, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiOkResponse, ApiTooManyRequestsResponse, ApiBearerAuth, ApiNotFoundResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { GenerateOtpDto } from './dto/generate-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { CompleteRegistrationDto } from './dto/complete-registration.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('otp')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Generate OTP (Production)', description: 'Generates an OTP and sends it via email.' })
  @ApiOkResponse({ description: 'The OTP has been generated and dispatched via email successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  async generateOtp(@Body() payload: GenerateOtpDto) {
    // isDevReturn = false
    return this.authService.generateOtp(payload, false);
  }


  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Verify OTP & Issue Token', description: 'Validates an OTP against the cache and returns a signed JWT Access Token.' })
  @ApiOkResponse({ description: 'OTP verified and Access Token issued.' })
  @ApiForbiddenResponse({ description: 'Maximum verification attempts exceeded.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  async verifyOtp(@Body() payload: VerifyOtpDto, @Req() request: Request) {
    const metadata = {
      ip: request.clientIp || 'unknown',
      userAgent: request.userAgent || 'unknown',
    };
    return this.authService.verifyOtpWithMetadata(payload, metadata);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Refresh Access Token', description: 'Renews the user session by providing a fresh Access Token using a valid Refresh Token.' })
  @ApiOkResponse({ description: 'New Access Token and Refresh Token issued.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  async refreshToken(@Body() payload: RefreshTokenDto) {
    return this.authService.refreshToken(payload);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'List Active Sessions', description: 'Returns a list of all active sessions/devices for the authenticated user.' })
  async getSessions(@CurrentUser('sub') userId: string) {
    return this.authService.getSessions(userId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Logout', description: 'Invalidates the current session token.' })
  async logout(@CurrentUser('sub') userId: string, @CurrentUser('sid') sessionId: string) {
    return this.authService.logout(userId, sessionId);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Logout from all devices', description: 'Invalidates all active session tokens for the current user.' })
  @ApiOkResponse({ description: 'Logged out from all devices successfully' })
  async logoutAll(@CurrentUser('sub') userId: string) {
    return this.authService.logoutAll(userId);
  }

  @Delete('sessions/:sid')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Kill Session', description: 'Terminates a specific active session by its ID.' })
  @ApiOkResponse({ description: 'Session terminated successfully' })
  @ApiNotFoundResponse({ description: 'The session ID provided was not found.' })
  async killSession(@CurrentUser('sub') userId: string, @Param('sid') sessionIdToKill: string) {
    return this.authService.killSession(userId, sessionIdToKill);
  }

  @Post('complete-registration')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Auth')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Complete User Registration', description: 'Updates an authenticated user profile with initial mandatory fields (Protected route).' })
  @ApiOkResponse({ description: 'Registration profile completed successfully' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  async completeRegistration(
    @CurrentUser('sub') userId: string,
    @CurrentUser('email') email: string,
    @Body() payload: CompleteRegistrationDto,
  ) {
    return this.authService.completeRegistration(userId, email, payload);
  }
}
