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
    return this.prisma.invitation.create({
      data: {
        email: data.email,
        token: data.token,
        expiresAt: data.expiresAt,
        organization: { connect: { id: data.organizationId } },
        role: { connect: { organizationId_name: { organizationId: data.organizationId, name: data.role } } }
      }
    });
  }

  async findByToken(token: string): Promise<InvitationWithOrg | null> {
    return this.prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        role: {
          select: { name: true },
        },
      },
    });
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
    return this.prisma.invitation.findMany({
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
    });
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

