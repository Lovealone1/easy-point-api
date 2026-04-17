import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Invitation, InvitationStatus } from '@prisma/client';

export type InvitationWithOrg = Invitation & {
  organization: { id: string; name: string };
};

@Injectable()
export class InvitationsRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(data: Prisma.InvitationUncheckedCreateInput): Promise<Invitation> {
    return this.prisma.invitation.create({ data });
  }

  async findByToken(token: string): Promise<InvitationWithOrg | null> {
    return this.prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: { id: true, name: true },
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
}
