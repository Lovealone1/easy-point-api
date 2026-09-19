import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get, Delete, Param, Req, Res, UnauthorizedException, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiOkResponse, ApiTooManyRequestsResponse, ApiBearerAuth, ApiNotFoundResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import type { ConfigType } from '@nestjs/config';
import { SessionScope, GlobalRole } from '@prisma/client';
import appConfig from '../../common/config/config.js';
import { AuthService } from './auth.service.js';
import { RequestAdminOtpDto, VerifyAdminOtpDto } from './dto/admin-login.dto.js';
import { AuthIntent } from './enums/auth-intent.enum.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';
import { RequireSessionScope } from '../../common/decorators/session-scope.decorator.js';
import { setSessionCookies, clearSessionCookies } from './session-cookies.js';
import { sessionCookieNames } from './session.constants.js';

/**
 * Sign-in for the administration console.
 *
 * Easy Point serves the console and the tenant dashboard from one domain and
 * one deployment, but they are two applications: this controller issues its
 * own cookie pair, its own `sid` in Redis and its own refresh-token rows, all
 * carrying SessionScope.ADMIN. Consequences, none of them accidental:
 *
 *   - Reaching /admin while signed into the dashboard prompts for a code. The
 *     dashboard session is not a console session and never becomes one.
 *   - Signing out here leaves the dashboard signed in, and the reverse. Only
 *     `POST /auth/logout-all` deliberately clears both.
 *   - A console session lasts hours, not a month (JWT_ADMIN_REFRESH_EXPIRES_IN).
 *
 * Authorization lives in RolesGuard, which requires SessionScope.ADMIN on
 * every @Roles(GlobalRole.ADMIN) route across the codebase — so a dashboard
 * token reaches no console endpoint even if it belongs to a global admin.
 */
@Controller('auth/admin')
@AllowWithoutSubscription()
export class AdminAuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(appConfig.KEY) private readonly config: ConfigType<typeof appConfig>,
  ) { }

  private setAdminCookies(response: Response, accessToken: string, refreshToken: string) {
    setSessionCookies(response, SessionScope.ADMIN, accessToken, refreshToken, {
      secure: this.config.app.env === 'production',
      refreshMaxAgeMs: this.config.jwt.adminRefreshExpiresInMs,
    });
  }

  @Post('otp')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Auth')
  @ApiOperation({
    summary: 'Request an administration console sign-in code',
    description:
      'Emails a one-time code that opens the administration console. Always answers as if the code was sent, even when the address is not a global administrator, so the endpoint cannot be used to discover who holds admin rights.',
  })
  @ApiOkResponse({ description: 'Request accepted.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  async requestOtp(@Body() payload: RequestAdminOtpDto) {
    return this.authService.generateAdminOtp(payload.email);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Auth')
  @ApiOperation({
    summary: 'Verify the console code and open a console session',
    description:
      'Validates the code and issues an administration-console session in its own cookies. Rejects any account that is not a global administrator, even when the code itself was valid.',
  })
  @ApiOkResponse({ description: 'Console session opened.' })
  @ApiForbiddenResponse({ description: 'The account may not access the administration console.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  async verifyOtp(
    @Body() payload: VerifyAdminOtpDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const metadata = {
      ip: request.clientIp || 'unknown',
      userAgent: request.userAgent || 'unknown',
    };

    // The intent is fixed here rather than taken from the body, so this route
    // can only ever consume a code minted for the console.
    const result = await this.authService.verifyOtpWithMetadata(
      { email: payload.email, otp: payload.otp, intent: AuthIntent.ADMIN_LOGIN },
      metadata,
      SessionScope.ADMIN,
    );

    const { accessToken, refreshToken, ...rest } = result;
    this.setAdminCookies(response, accessToken, refreshToken);

    return rest;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Refresh the console session', description: 'Rotates the console tokens using the console refresh cookie. A dashboard refresh token presented here is rejected.' })
  @ApiOkResponse({ description: 'New console tokens issued.' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshTokenString = request.cookies?.[sessionCookieNames(SessionScope.ADMIN).refresh];

    if (!refreshTokenString) {
      throw new UnauthorizedException('Refresh token missing from cookies');
    }

    const result = await this.authService.refreshToken(refreshTokenString, SessionScope.ADMIN);
    const { accessToken, refreshToken, ...rest } = result;

    this.setAdminCookies(response, accessToken, refreshToken);

    return rest;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @RequireSessionScope(SessionScope.ADMIN)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Current console operator', description: 'Returns the signed-in administrator profile. Answers only to a console session.' })
  @ApiOkResponse({ description: 'Profile retrieved successfully.' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @RequireSessionScope(SessionScope.ADMIN)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'List active console sessions', description: 'Console sessions only — dashboard sessions are listed by GET /auth/sessions.' })
  async getSessions(@CurrentUser('sub') userId: string) {
    return this.authService.getSessions(userId, SessionScope.ADMIN);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @RequireSessionScope(SessionScope.ADMIN)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Leave the console', description: 'Ends the console session and leaves any dashboard session untouched.' })
  async logout(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sid') sessionId: string,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    clearSessionCookies(response, SessionScope.ADMIN);
    const refreshToken = request.cookies?.[sessionCookieNames(SessionScope.ADMIN).refresh];
    return this.authService.logout(userId, sessionId, SessionScope.ADMIN, refreshToken);
  }

  @Delete('sessions/:sid')
  @UseGuards(JwtAuthGuard)
  @RequireSessionScope(SessionScope.ADMIN)
  @ApiBearerAuth()
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Kill a console session', description: 'Terminates one of your own console sessions by its ID.' })
  @ApiOkResponse({ description: 'Session terminated successfully' })
  @ApiNotFoundResponse({ description: 'The session ID provided was not found.' })
  async killSession(@CurrentUser('sub') userId: string, @Param('sid') sessionIdToKill: string) {
    return this.authService.killSession(userId, sessionIdToKill, SessionScope.ADMIN);
  }
}
