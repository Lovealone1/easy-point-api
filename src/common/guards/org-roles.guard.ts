import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, OrganizationStatus, GlobalRole } from '@prisma/client';
import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { getTenantId } from '../context/tenant.context.js';

@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User authentication is missing');
    }

    // Global Admin Bypass: Global Admins can access any endpoint protected by OrgRolesGuard
    if (user.role === GlobalRole.ADMIN) {
      return true;
    }

    const userId = user.sub || user.id;

    if (!userId) {
      throw new UnauthorizedException('User identification is missing from the authentication payload');
    }

    const organizationId = getTenantId();

    if (!organizationId) {
      throw new BadRequestException('Organization identifier could not be inferred from params, body, or headers');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new ForbiddenException('Organization not found');
    }

    if (organization.status !== OrganizationStatus.ACTIVE || !organization.isActive) {
      throw new ForbiddenException('This organization is currently inactive or suspended');
    }

    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId: organizationId,
        },
      },
    });

    if (!orgUser) {
      throw new ForbiddenException('You do not belong to this organization');
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(orgUser.role)) {
      throw new ForbiddenException('You do not have the required role in this organization to perform this action');
    }

    request.organization = organization;
    request.orgRole = orgUser.role;

    return true;
  }
}
