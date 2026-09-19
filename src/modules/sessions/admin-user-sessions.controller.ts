import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GlobalRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuditService } from '../../infraestructure/audit/audit.service.js';
import { AuditAction } from '../../infraestructure/audit/enums/audit-action.enum.js';
import { AuditSeverity } from '../../infraestructure/audit/enums/audit-severity.enum.js';
import { SessionsService } from './sessions.service.js';

/**
 * The administration console's view of one user's sessions.
 *
 * `@Roles(GlobalRole.ADMIN)` is doing more work than it looks: `RolesGuard`
 * requires `scope === ADMIN` on every route that declares it, so these
 * endpoints are reachable only from a console session, never from a dashboard
 * token that happens to belong to a global administrator. See docs/SESSIONS.md.
 *
 * Unlike the personal-space routes, this one crosses the scope split: an
 * administrator investigating an account needs to see both the dashboard and
 * the console sessions it holds. Every revocation here is audited with the
 * administrator as the actor and the account as the target.
 */
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users/:userId/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
export class AdminUserSessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List a user active sessions across both applications (Admin Global Only)',
    description:
      'Every device and browser the account is currently signed in from, in the dashboard and in the administration console, most recently used first.',
  })
  @ApiOkResponse({ description: 'Active sessions returned.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  async list(@Param('userId') userId: string) {
    // Resolve the user first so an id that does not exist answers 404 rather
    // than an empty list — the two mean very different things to whoever is
    // reading the screen.
    await this.sessionsService.assertUserExists(userId);

    return this.sessionsService.listAllScopes(userId);
  }

  @Delete(':sid')
  @ApiOperation({
    summary: 'Terminate one session of a user (Admin Global Only)',
    description:
      'Ends a single session by id, in whichever application it belongs to.',
  })
  @ApiOkResponse({ description: 'Session terminated.' })
  @ApiNotFoundResponse({ description: 'User or session not found.' })
  async revoke(
    @Param('userId') userId: string,
    @Param('sid') sid: string,
    @CurrentUser('sub') actorUserId: string,
  ) {
    await this.sessionsService.assertUserExists(userId);

    return this.sessionsService.revokeAnyScope(userId, sid, actorUserId);
  }

  @Post('revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign a user out everywhere (Admin Global Only)',
    description:
      'Ends every session the account holds in both applications and revokes every refresh token it owns. The account can sign in again immediately — this is a reset, not a lockout.',
  })
  @ApiOkResponse({ description: 'All sessions terminated.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  async revokeAll(
    @Param('userId') userId: string,
    @CurrentUser('sub') actorUserId: string,
  ) {
    await this.sessionsService.assertUserExists(userId);

    const revoked = await this.sessionsService.revokeAll(userId, actorUserId);

    this.auditService.log({
      action: AuditAction.LOGOUT,
      resourceType: 'Session',
      userId: actorUserId,
      metadata: {
        scope: 'ALL_DEVICES',
        sessionCount: revoked,
        targetUserId: userId,
        onBehalfOfAnotherUser: actorUserId !== userId,
      },
      severity: AuditSeverity.HIGH,
    });

    return { message: 'All sessions terminated successfully', revoked };
  }
}
