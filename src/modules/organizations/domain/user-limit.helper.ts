import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { getPlanLimits } from '../../plans/domain/plan-metadata.js';

/**
 * Enforces Plan.metadata.maxUsers (null = unlimited) against the org's
 * current membership + pending invitations, both counted so two concurrent
 * invites can't both slip in under the limit. Call before creating an
 * invitation or a direct membership.
 */
export async function assertUserLimitNotExceeded(
  prisma: PrismaService,
  organizationId: string,
): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: { organizationId, status: { in: ['ACTIVE', 'TRIALING'] } },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  });

  const maxUsers = getPlanLimits(subscription?.plan.metadata).maxUsers;
  if (maxUsers === null || maxUsers === undefined) return;

  const [memberCount, pendingInvitations] = await Promise.all([
    prisma.organizationUser.count({ where: { organizationId } }),
    prisma.invitation.count({ where: { organizationId, status: 'PENDING' } }),
  ]);

  if (memberCount + pendingInvitations >= maxUsers) {
    throw new BadRequestException(
      `Tu plan actual permite hasta ${maxUsers} usuarios. Actualiza tu plan para invitar a más miembros.`,
    );
  }
}
