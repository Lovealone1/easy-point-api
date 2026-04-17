import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { InvitationStatus, Role } from '@prisma/client';
import crypto from 'crypto';

import appConfig from '../../common/config/config.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InvitationsRepository } from './invitations.repository.js';
import { OrganizationUsersRepository } from '../organization-users/organization-users.repository.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';

/** TTL for stored invitation record: 72 hours */
const INVITATION_TTL_HOURS = 72;

/** TTL for the temporary JWT emitted on verify (new users only): 20 minutes */
const TEMP_TOKEN_EXPIRES_IN = '20m';

/** Payload embedded in the short-lived invite JWT */
export interface InviteTokenPayload {
  sub: null;
  email: string;
  canRegister: true;
  invitationToken: string;
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly invitationsRepository: InvitationsRepository,
    private readonly orgUsersRepository: OrganizationUsersRepository,
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  // POST /invitations  (admin / owner only)
  // ────────────────────────────────────────────────────────────────────────────
  async createInvitation(
    organizationId: string,
    dto: CreateInvitationDto,
  ): Promise<{ message: string; invitationId: string }> {
    const { email, role } = dto;

    // Block OWNER invitations — ownership must be transferred differently
    if (role === Role.OWNER) {
      throw new BadRequestException('Cannot invite a user with OWNER role');
    }

    // Avoid duplicate pending invitations to the same org
    const existing = await this.invitationsRepository.findByEmailAndOrg(
      email,
      organizationId,
    );
    if (existing) {
      throw new ConflictException(
        'A pending invitation already exists for this email in this organization',
      );
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000,
    );

    const invitation = await this.invitationsRepository.create({
      email,
      token,
      role,
      organizationId,
      expiresAt,
    });

    // ── DEV EVENT: log token to console instead of sending email ──
    this.logger.log(
      `[INVITATION CREATED] id=${invitation.id} | email=${email} | role=${role} | token=${token} | expiresAt=${expiresAt.toISOString()}`,
    );

    return {
      message: 'Invitation created successfully',
      invitationId: invitation.id,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // GET /invitations/verify/:token  (public)
  // ────────────────────────────────────────────────────────────────────────────
  async verifyToken(token: string): Promise<{
    email: string;
    role: Role;
    organizationName: string;
    tempInviteToken?: string;
  }> {
    const invitation = await this.invitationsRepository.findByToken(token);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Invitation is no longer valid (status: ${invitation.status})`,
      );
    }

    if (new Date() > invitation.expiresAt) {
      // Mark as expired lazily
      await this.invitationsRepository.updateStatus(
        invitation.id,
        InvitationStatus.EXPIRED,
      );
      throw new BadRequestException('Invitation has expired');
    }

    const baseResponse = {
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
    };

    // Check whether this email already has a user account
    const existingUser = await this.prismaService.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      // Existing user → no temp token; they should POST /invitations/accept
      return baseResponse;
    }

    // New user → issue a short-lived bypass JWT
    const payload: InviteTokenPayload = {
      sub: null,
      email: invitation.email,
      canRegister: true,
      invitationToken: token,
    };

    const tempInviteToken = await this.jwtService.signAsync(payload, {
      secret: this.config.jwt.secret,
      expiresIn: TEMP_TOKEN_EXPIRES_IN,
    });

    this.logger.log(
      `[INVITE VERIFY] New user detected for ${invitation.email} — tempInviteToken issued`,
    );

    return { ...baseResponse, tempInviteToken };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // POST /invitations/accept  (existing authenticated user)
  // ────────────────────────────────────────────────────────────────────────────
  async acceptInvitation(
    userId: string,
    userEmail: string,
    invitationToken: string,
  ): Promise<{ message: string }> {
    const invitation =
      await this.invitationsRepository.findByToken(invitationToken);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Invitation is no longer valid (status: ${invitation.status})`,
      );
    }

    if (new Date() > invitation.expiresAt) {
      await this.invitationsRepository.updateStatus(
        invitation.id,
        InvitationStatus.EXPIRED,
      );
      throw new BadRequestException('Invitation has expired');
    }

    // Email lock: the invitation must target the authenticated user's email
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new BadRequestException(
        'This invitation was not issued for your account',
      );
    }

    // Prevent duplicate membership
    const alreadyMember = await this.orgUsersRepository.findByUserIdAndOrganizationId(
      userId,
      invitation.organizationId,
    );
    if (alreadyMember) {
      throw new ConflictException(
        'You are already a member of this organization',
      );
    }

    // Atomic: create membership + accept invitation
    await this.prismaService.$transaction([
      this.prismaService.organizationUser.create({
        data: {
          userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      }),
      this.prismaService.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      }),
    ]);

    this.logger.log(
      `[INVITATION ACCEPTED] userId=${userId} joined org=${invitation.organizationId} as ${invitation.role}`,
    );

    return { message: 'Invitation accepted successfully' };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Used by AuthService during completeRegistration (new user via invite)
  // ────────────────────────────────────────────────────────────────────────────
  async acceptInvitationInTransaction(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    userEmail: string,
    invitationToken: string,
  ): Promise<void> {
    const invitation = await tx.invitation.findUnique({
      where: { token: invitationToken },
    });

    if (!invitation) throw new NotFoundException('Invitation not found');

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Invitation is no longer valid (status: ${invitation.status})`,
      );
    }

    if (new Date() > invitation.expiresAt) {
      throw new BadRequestException('Invitation has expired');
    }

    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new BadRequestException(
        'This invitation was not issued for your account',
      );
    }

    await tx.organizationUser.create({
      data: {
        userId,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED },
    });
  }
}
