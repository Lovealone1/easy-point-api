import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get, Delete, Param, Req, Res, UnauthorizedException, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiOkResponse, ApiTooManyRequestsResponse, ApiBearerAuth, ApiNotFoundResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../common/config/config.js';
import { AuthService } from './auth.service.js';
import { GenerateOtpDto } from './dto/generate-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { SessionScope } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';
import { RequireSessionScope } from '../../common/decorators/session-scope.decorator.js';
import { setSessionCookies, clearSessionCookies } from './session-cookies.js';
import { sessionCookieNames } from './session.constants.js';

/**
 * Sign-in for the tenant dashboard. The administration console has its own
 * controller at `auth/admin` and its own cookies, session and lifetime — see
 * AdminAuthController.
 *
 * Every authenticated route here is pinned to the dashboard scope, so a
 * console token cannot drive dashboard session management.
 */
@Controller('auth')
@AllowWithoutSubscription()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(appConfig.KEY) private readonly config: ConfigType<typeof appConfig>,
  ) { }

  private setAuthCookies(response: Response, accessToken: string, refreshToken: string) {
    setSessionCookies(response, SessionScope.TENANT, accessToken, refreshToken, {
      secure: this.config.app.env === 'production',
      refreshMaxAgeMs: this.config.jwt.refreshExpiresInMs,
    });
  }

  private clearAuthCookies(response: Response) {
    clearSessionCookies(response, SessionScope.TENANT);
  }

  @Post('otp')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Generate OTP (Production)', description: 'Generates an OTP and sends it via email.' })
  @ApiOkResponse({ description: 'The OTP has been generated and dispatched via email successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  async generateOtp(@Body() payload: GenerateOtpDto) {
    return this.authService.generateOtp(payload, false);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Verify OTP & Issue Token', description: 'Validates an OTP against the cache and returns a signed JWT Access Token in cookies.' })
  @ApiOkResponse({ description: 'OTP verified and tokens issued in cookies.' })
  @ApiForbiddenResponse({ description: 'Maximum verification attempts exceeded.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  async verifyOtp(@Body() payload: VerifyOtpDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const metadata = {
      ip: request.clientIp || 'unknown',
      userAgent: request.userAgent || 'unknown',
    };

    const result = await this.authService.verifyOtpWithMetadata(payload, metadata, SessionScope.TENANT);
    const { accessToken, refreshToken, ...rest } = result;

    this.setAuthCookies(response, accessToken, refreshToken);

    return rest;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Refresh Access Token', description: 'Renews the user session by providing fresh tokens via cookies using a valid Refresh Token cookie.' })
  @ApiOkResponse({ description: 'New Access Token and Refresh Token issued.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  async refreshToken(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshTokenString = request.cookies?.[sessionCookieNames(SessionScope.TENANT).refresh];

    if (!refreshTokenString) {
      throw new UnauthorizedException('Refresh token missing from cookies');
    }

    const result = await this.authService.refreshToken(refreshTokenString, SessionScope.TENANT);
    const { accessToken, refreshToken, ...rest } = result;

    this.setAuthCookies(response, accessToken, refreshToken);

    return rest;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @RequireSessionScope(SessionScope.TENANT)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Get current user profile', description: 'Returns the logged-in user profile along with joined organizations and visual branding configs.' })
  @ApiOkResponse({ description: 'Profile retrieved successfully.' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @RequireSessionScope(SessionScope.TENANT)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'List Active Sessions', description: 'Returns a list of all active sessions/devices for the authenticated user.' })
  async getSessions(@CurrentUser('sub') userId: string) {
    return this.authService.getSessions(userId, SessionScope.TENANT);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @RequireSessionScope(SessionScope.TENANT)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Logout', description: 'Invalidates the current session token.' })
  async logout(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sid') sessionId: string,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request
  ) {
    this.clearAuthCookies(response);
    const refreshToken = request.cookies?.[sessionCookieNames(SessionScope.TENANT).refresh];
    return this.authService.logout(userId, sessionId, SessionScope.TENANT, refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @RequireSessionScope(SessionScope.TENANT)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Logout from all devices', description: 'Invalidates every active session for the current user, in the dashboard AND the administration console. Deliberately the one action that crosses both applications.' })
  @ApiOkResponse({ description: 'Logged out from all devices successfully' })
  async logoutAll(@CurrentUser('sub') userId: string, @Res({ passthrough: true }) response: Response) {
    this.clearAuthCookies(response);
    return this.authService.logoutAll(userId);
  }

  @Delete('sessions/:sid')
  @UseGuards(JwtAuthGuard)
  @RequireSessionScope(SessionScope.TENANT)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Kill Session', description: 'Terminates a specific active session by its ID.' })
  @ApiOkResponse({ description: 'Session terminated successfully' })
  @ApiNotFoundResponse({ description: 'The session ID provided was not found.' })
  async killSession(@CurrentUser('sub') userId: string, @Param('sid') sessionIdToKill: string) {
    return this.authService.killSession(userId, sessionIdToKill, SessionScope.TENANT);
  }
}
