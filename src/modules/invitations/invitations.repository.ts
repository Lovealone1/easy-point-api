import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Invitation, InvitationStatus } from '@prisma/client';

export type InvitationWithOrg = Invitation & {
  organization: { id: string; name: string };
  role: { name: string; };
};

@Injectable()
export class InvitationsRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(data: { email: string, token: string, role: string, organizationId: string, expiresAt: Date }): Promise<Invitation> {
    // `Invitation` is tenant-exempt, so this statement would otherwise run with
    // no tenant published to Postgres. The nested connect resolves a `roles`
    // row, and `roles` IS under RLS — with no `app.current_org_id` set the
    // policy hides every role and Prisma reports the connect target as missing.
    // Running inside a tenant transaction publishes the setting for both
    // statements.
    return this.prisma.$tenantTransaction((tx) =>
      tx.invitation.create({
        data: {
          email: data.email,
          token: data.token,
          expiresAt: data.expiresAt,
          organization: { connect: { id: data.organizationId } },
          role: { connect: { organizationId_name: { organizationId: data.organizationId, name: data.role } } }
        }
      }),
    );
  }

  async findByToken(token: string): Promise<InvitationWithOrg | null> {
    // Looked up by an invitee who is not a member yet, so there is no tenant to
    // publish — but the included `role` lives in an RLS-protected table and
    // would come back null, which callers type as non-nullable. This is the
    // control-plane read the bypass escape hatch exists for.
    return this.prisma.$systemTransaction((tx) =>
      tx.invitation.findUnique({
        where: { token },
        include: {
          organization: {
            select: { id: true, name: true },
          },
          role: {
            select: { name: true },
          },
        },
      }),
    );
  }

  async findByEmailAndOrg(
    email: string,
    organizationId: string,
  ): Promise<Invitation | null> {
    return this.prisma.invitation.findFirst({
      where: {
        email,
        organizationId,
        status: InvitationStatus.PENDING,
      },
    });
  }

  async updateStatus(id: string, status: InvitationStatus): Promise<Invitation> {
    return this.prisma.invitation.update({
      where: { id },
      data: { status },
    });
  }

  async findPendingByOrg(organizationId: string): Promise<Invitation[]> {
    return this.prisma.invitation.findMany({
      where: { organizationId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMany(organizationId: string): Promise<InvitationWithOrg[]> {
    // Same reason as `create`: `Invitation` is tenant-exempt, but the included
    // `role` is not. Without the tenant published, RLS hides every joined role
    // and each invitation comes back with `role: null`.
    return this.prisma.$tenantTransaction((tx) =>
      tx.invitation.findMany({
        where: { organizationId },
        include: {
          organization: {
            select: { id: true, name: true },
          },
          role: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findById(id: string): Promise<Invitation | null> {
    return this.prisma.invitation.findUnique({
      where: { id },
    });
  }

  async delete(id: string): Promise<Invitation> {
    return this.prisma.invitation.delete({
      where: { id },
    });
  }
}

