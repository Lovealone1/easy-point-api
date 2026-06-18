import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiSecurity,
} from '@nestjs/swagger';

import { InvitationsService } from './invitations.service.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateAdminInvitationDto } from './dto/create-admin-invitation.dto.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { GlobalRole } from '@prisma/client';

@ApiTags('Invitations')
@ApiSecurity('x-organization-id')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) { }

  // ── POST /invitations ───────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('invitations:create')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create invitation',
    description:
      'Creates a pending invitation for an email. Restricted to OWNER and ADMINISTRATOR roles. ' +
      'In development the generated token is printed to the server console.',
  })
  @ApiCreatedResponse({ description: 'Invitation created — check server logs for the token (dev).' })
  @ApiConflictResponse({ description: 'A pending invitation already exists for this email.' })
  @ApiBadRequestResponse({ description: 'Validation error or OWNER role not allowed.' })
  async createInvitation(
    @Body() dto: CreateInvitationDto,
  ) {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException(
        'Organization context is missing. Send x-organization-id header.',
      );
    }
    return this.invitationsService.createInvitation(organizationId, dto);
  }

  // ── GET /invitations ────────────────────────────────────────────────────────
  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('invitations:read')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all invitations for the active organization',
    description: 'Lists all invitations (pending, accepted, expired, revoked) for the active organization.',
  })
  @ApiOkResponse({ description: 'List of invitations' })
  @ApiBadRequestResponse({ description: 'Organization context is missing.' })
  async getInvitations() {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException(
        'Organization context is missing. Send x-organization-id header.',
      );
    }
    return this.invitationsService.findAll(organizationId);
  }

  // ── GET /invitations/verify/:token ─────────────────────────────────────────
  @Get('verify/:token')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'token', description: 'Raw invitation token (UUID)' })
  @ApiOperation({
    summary: 'Verify invitation token (public)',
    description:
      'Validates the token and returns invitation metadata. ' +
      'If the invited email does NOT yet have a user account, a short-lived ' +
      'tempInviteToken (20 min) is also returned to bypass OTP on registration.',
  })
  @ApiOkResponse({ description: 'Token is valid — returns email, role, organizationName (+ tempInviteToken for new users).' })
  @ApiBadRequestResponse({ description: 'Token expired or already used.' })
  @ApiNotFoundResponse({ description: 'Token not found.' })
  async verifyToken(@Param('token') token: string) {
    return this.invitationsService.verifyToken(token);
  }

  // ── POST /invitations/accept ────────────────────────────────────────────────
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Accept invitation (existing user)',
    description:
      'Links the authenticated users account to the invited organization. ' +
      'Use this endpoint when the invited user already has an account. ' +
      'New users should use POST /auth/complete-registration instead.',
  })
  @ApiOkResponse({ description: 'Invitation accepted — organization membership created.' })
  @ApiBadRequestResponse({ description: 'Token expired, already used, or email mismatch.' })
  @ApiNotFoundResponse({ description: 'Invitation not found.' })
  @ApiConflictResponse({ description: 'User is already a member of this organization.' })
  async acceptInvitation(
    @CurrentUser('sub') userId: string,
    @CurrentUser('email') userEmail: string,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.invitationsService.acceptInvitation(
      userId,
      userEmail,
      dto.invitationToken,
    );
  }

  // ── DELETE /invitations/:id ──────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('invitations:cancel')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a pending invitation',
    description: 'Deletes a pending invitation by ID. Restricted to OWNER and ADMINISTRATOR roles.',
  })
  @ApiParam({ name: 'id', description: 'Invitation UUID' })
  @ApiOkResponse({ description: 'Invitation deleted successfully.' })
  @ApiBadRequestResponse({ description: 'Invitation is not in PENDING status or organization context missing.' })
  @ApiNotFoundResponse({ description: 'Invitation not found.' })
  async deleteInvitation(@Param('id') id: string) {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException(
        'Organization context is missing. Send x-organization-id header.',
      );
    }
    return this.invitationsService.deleteInvitation(id, organizationId);
  }

  // ── POST /invitations/admin ────────────────────────────────────────────────
  @Post('admin')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create invitation globally (Admin Only)',
    description: 'Creates a pending invitation for an email in any organization.',
  })
  @ApiCreatedResponse({ description: 'Invitation created successfully.' })
  @ApiConflictResponse({ description: 'A pending invitation already exists for this email in that organization.' })
  @ApiBadRequestResponse({ description: 'Validation error or OWNER role not allowed.' })
  async createAdminInvitation(
    @Body() dto: CreateAdminInvitationDto,
  ) {
    return this.invitationsService.createAdminInvitation(dto);
  }

  // ── GET /invitations/admin ─────────────────────────────────────────────────
  @Get('admin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all invitations in the system (Admin Only)',
    description: 'Lists all invitations across all organizations.',
  })
  @ApiOkResponse({ description: 'List of all invitations.' })
  async getGlobalInvitations() {
    return this.invitationsService.findAllGlobal();
  }

  // ── DELETE /invitations/admin/:id ──────────────────────────────────────────
  @Delete('admin/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a pending invitation globally (Admin Only)',
    description: 'Deletes a pending invitation by ID across any organization.',
  })
  @ApiParam({ name: 'id', description: 'Invitation UUID' })
  @ApiOkResponse({ description: 'Invitation deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Invitation not found.' })
  async deleteInvitationGlobal(@Param('id') id: string) {
    return this.invitationsService.deleteInvitationGlobal(id);
  }
}
