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
import { Role } from '../../common/enums/role.enum.js';
import { InvitationStatus } from '@prisma/client';
import crypto from 'crypto';

import appConfig from '../../common/config/config.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InvitationsRepository, InvitationWithOrg } from './invitations.repository.js';
import { OrganizationUsersRepository } from '../organization-users/organization-users.repository.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';
import { getInvitationEmailTemplate } from '../../infraestructure/mail/templates/invitation.template.js';

/** TTL for stored invitation record: 48 hours */
const INVITATION_TTL_HOURS = 48;



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
    private readonly mailService: MailService,
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



    const organization = await this.prismaService.organization.findUnique({
      where: { id: organizationId },
    });

    const roleData = await this.prismaService.role.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: role,
        },
      },
    });

    if (organization && roleData) {
      const invitationLink = `${this.config.app.frontendUrl}/auth/invitation?token=${token}`;
      const htmlContent = getInvitationEmailTemplate(
        organization.name,
        roleData.name,
        invitationLink,
      );

      await this.mailService.sendMail(
        email,
        `You have been invited to join ${organization.name} on Easy Point`,
        htmlContent,
      );
    }

    return {
      message: 'Invitation created successfully',
      invitationId: invitation.id,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // GET /invitations (list all organization invitations)
  // ────────────────────────────────────────────────────────────────────────────
  async findAll(organizationId: string): Promise<InvitationWithOrg[]> {
    // Lazily update expired pending invitations for this organization
    await this.prismaService.invitation.updateMany({
      where: {
        organizationId,
        status: InvitationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: {
        status: InvitationStatus.EXPIRED,
      },
    });

    return this.invitationsRepository.findMany(organizationId);
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
      role: invitation.role.name as Role,
      organizationName: invitation.organization.name,
    };

    return baseResponse;
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
          roleId: invitation.roleId,
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
        roleId: invitation.roleId,
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DEV ONLY: Get pending invitations
  // ────────────────────────────────────────────────────────────────────────────
  async getDevInvitations() {
    if (this.config.app.env === 'production') {
      import('@nestjs/common').then(m => {
        throw new m.ForbiddenException('Development endpoints are disabled in production');
      });
    }

    const invitations = await this.prismaService.invitation.findMany({
      where: { status: InvitationStatus.PENDING },
      select: {
        id: true,
        email: true,
        token: true,
        expiresAt: true,
        organization: { select: { name: true } },
        role: { select: { name: true } }
      },
      orderBy: { expiresAt: 'desc' },
    });

    this.logger.log(`[DEV ONLY] Showing ${invitations.length} pending invitations in console:`);
    console.table(
      invitations.map(inv => ({
        email: inv.email,
        token: inv.token,
        organization: inv.organization.name,
        role: inv.role.name,
      }))
    );

    return {
      message: 'Dev only: Pending invitations',
      count: invitations.length,
      invitations,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DELETE /invitations/:id (delete a pending invitation)
  // ────────────────────────────────────────────────────────────────────────────
  async deleteInvitation(id: string, organizationId: string): Promise<{ message: string }> {
    const invitation = await this.invitationsRepository.findById(id);

    if (!invitation || invitation.organizationId !== organizationId) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be deleted');
    }

    await this.invitationsRepository.delete(id);

    return {
      message: 'Invitation deleted successfully',
    };
  }
}

