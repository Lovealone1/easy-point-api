import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SessionScope } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';
import { clearSessionCookies } from '../auth/session-cookies.js';
import { SessionsService } from './sessions.service.js';

/**
 * Account settings → Sessions. Sits beside `me/preferences` in the personal
 * space: the same user, the same "my account" area of the dashboard.
 *
 * Everything here is scoped to the application the caller is signed into,
 * which the guard has already read off the token. A dashboard session cannot
 * see or end a console session through these routes, and the reverse — see
 * docs/SESSIONS.md. The one endpoint that crosses the split on purpose stays
 * where it was, at `POST /auth/logout-all`.
 *
 * Deliberately not pinned with `@RequireSessionScope`: both applications have
 * an account-settings screen, and each one correctly sees its own sessions.
 */
@ApiTags('Account Settings — Sessions')
@ApiBearerAuth()
@Controller('me/sessions')
@UseGuards(JwtAuthGuard)
@AllowWithoutSubscription()
export class MySessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List my active sessions',
    description:
      'Every device and browser currently signed into this application, most recently used first. The session making the request is flagged with `current: true`.',
  })
  @ApiOkResponse({ description: 'Active sessions returned.' })
  list(
    @CurrentUser('sub') userId: string,
    @CurrentUser('scope') scope: SessionScope,
    @CurrentUser('sid') currentSid: string,
  ) {
    return this.sessionsService.list(userId, scope, currentSid);
  }

  @Post('revoke-others')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign out every other device',
    description:
      'Ends every session of this application except the one making the request. To end every session in both applications at once, use POST /auth/logout-all.',
  })
  @ApiOkResponse({ description: 'Other sessions terminated.' })
  revokeOthers(
    @CurrentUser('sub') userId: string,
    @CurrentUser('scope') scope: SessionScope,
    @CurrentUser('sid') currentSid: string,
  ) {
    return this.sessionsService.revokeOthers(userId, scope, currentSid);
  }

  @Delete(':sid')
  @ApiOperation({
    summary: 'Sign out one device',
    description:
      'Ends a single session by id. Revoking the session making the request also clears its cookies, so the row a user taps in their own session list behaves like signing out.',
  })
  @ApiOkResponse({ description: 'Session terminated.' })
  @ApiNotFoundResponse({ description: 'No such session in this application.' })
  async revoke(
    @CurrentUser('sub') userId: string,
    @CurrentUser('scope') scope: SessionScope,
    @CurrentUser('sid') currentSid: string,
    @Param('sid') sid: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.sessionsService.revoke(userId, sid, scope, userId);

    // Ending your own current session from the list is a legitimate thing to
    // do — it is the row labelled "this device". Leaving the cookies in place
    // would hand the browser credentials for a session that no longer exists,
    // and every subsequent request would 401 until something cleared them.
    if (sid === currentSid) {
      clearSessionCookies(response, scope);
    }

    return result;
  }
}
