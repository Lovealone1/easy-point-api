import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { OrganizationEntity } from './domain/organization.entity.js';

/**
 * Repository de Organization — capa de infraestructura.
 *
 * Responsabilidades:
 *  - Toda comunicación con la base de datos (Prisma).
 *  - Mapeo entre el modelo Prisma y la entidad de dominio OrganizationEntity.
 *
 * NO contiene lógica de negocio.
 */
@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: any,
  ): Promise<OrganizationEntity> {
    const { plan: planName, planActiveUntil, ...orgData } = data;
    const requestedPlanName = planName?.toUpperCase() ?? 'FREE';

    // 1. Find or create the plan record
    let planRecord = await this.prisma.plan.findUnique({
      where: { name: requestedPlanName },
    });

    if (!planRecord) {
      planRecord = await this.prisma.plan.create({
        data: {
          name: requestedPlanName,
          description: `Plan ${requestedPlanName}`,
          monthlyPrice: 0,
          yearlyPrice: 0,
          currency: 'USD',
          isActive: true,
        },
      });
    }

    const activeModules = await this.prisma.module.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const now = new Date();
    // Default period: if free, e.g. 100 years, if paid, 1 month
    const endPeriod = planActiveUntil ?? (requestedPlanName === 'FREE'
      ? new Date(now.getFullYear() + 100, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()));

    const raw = await this.prisma.organization.create({
      data: {
        ...orgData,
        roles: {
          create: [
            {
              name: 'OWNER',
              description: 'Rol Propietario de la Organización',
              isSystemDefault: true,
            },
            {
              name: 'ADMINISTRATOR',
              description: 'Rol Administrador de la Organización',
              isSystemDefault: true,
            },
          ],
        },
        organizationModules: {
          create: activeModules.map((m) => ({
            moduleId: m.id,
          })),
        },
        subscriptions: {
          create: [
            {
              planId: planRecord.id,
              billingCycle: 'MONTHLY',
              status: 'ACTIVE',
              currentPeriodStart: now,
              currentPeriodEnd: endPeriod,
            }
          ]
        }
      },
      include: {
        subscriptions: {
          where: {
            status: 'ACTIVE',
            currentPeriodEnd: { gte: now },
          },
          include: {
            plan: true,
          },
        },
      },
    });

    // Wire default permissions for OWNER and ADMINISTRATOR roles
    const createdRoles = await this.prisma.role.findMany({
      where: { organizationId: raw.id },
    });
    const ownerRole = createdRoles.find((r) => r.name === 'OWNER');
    const adminRole = createdRoles.find((r) => r.name === 'ADMINISTRATOR');

    const allPermissions = await this.prisma.permission.findMany({
      where: { isActive: true },
    });

    const rolePermissionsData: Prisma.RolePermissionCreateManyInput[] = [];

    if (ownerRole) {
      allPermissions.forEach((p) => {
        rolePermissionsData.push({
          roleId: ownerRole.id,
          permissionId: p.id,
          organizationId: raw.id,
        });
      });
    }

    if (adminRole) {
      allPermissions
        .filter((p) => !p.key.startsWith('organization_users:'))
        .forEach((p) => {
          rolePermissionsData.push({
            roleId: adminRole.id,
            permissionId: p.id,
            organizationId: raw.id,
          });
        });
    }

    if (rolePermissionsData.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: rolePermissionsData,
      });
    }

    return OrganizationEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.OrganizationWhereInput;
    orderBy?: Prisma.OrganizationOrderByWithRelationInput;
  }): Promise<[OrganizationEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.organization.findMany({
        skip,
        take,
        where,
        orderBy,
        include: {
          subscriptions: {
            where: {
              status: 'ACTIVE',
              currentPeriodEnd: { gte: new Date() },
            },
            include: {
              plan: true,
            },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return [rows.map(OrganizationEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<OrganizationEntity | null> {
    const raw = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        subscriptions: {
          where: {
            status: 'ACTIVE',
            currentPeriodEnd: { gte: new Date() },
          },
          include: {
            plan: true,
          },
        },
      },
    });
    return raw ? OrganizationEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: any,
  ): Promise<OrganizationEntity> {
    const { plan: planName, planActiveUntil, ...orgData } = data;

    if (planName !== undefined) {
      const requestedPlanName = planName.toUpperCase();
      let planRecord = await this.prisma.plan.findUnique({
        where: { name: requestedPlanName },
      });

      if (!planRecord) {
        planRecord = await this.prisma.plan.create({
          data: {
            name: requestedPlanName,
            description: `Plan ${requestedPlanName}`,
            monthlyPrice: 0,
            yearlyPrice: 0,
            currency: 'USD',
            isActive: true,
          },
        });
      }

      const now = new Date();
      const endPeriod = planActiveUntil ?? (requestedPlanName === 'FREE'
        ? new Date(now.getFullYear() + 100, now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()));

      // Deactivate existing active subscriptions
      await this.prisma.subscription.updateMany({
        where: {
          organizationId: id,
          status: 'ACTIVE',
        },
        data: {
          status: 'EXPIRED',
          cancelledAt: now,
        },
      });

      // Create new subscription
      await this.prisma.subscription.create({
        data: {
          organizationId: id,
          planId: planRecord.id,
          billingCycle: 'MONTHLY',
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: endPeriod,
        },
      });
    }

    const raw = await this.prisma.organization.update({
      where: { id },
      data: orgData,
      include: {
        subscriptions: {
          where: {
            status: 'ACTIVE',
            currentPeriodEnd: { gte: new Date() },
          },
          include: {
            plan: true,
          },
        },
      },
    });

    return OrganizationEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<OrganizationEntity> {
    const raw = await this.prisma.organization.delete({
      where: { id },
      include: {
        subscriptions: {
          where: {
            status: 'ACTIVE',
            currentPeriodEnd: { gte: new Date() },
          },
          include: {
            plan: true,
          },
        },
      },
    });
    return OrganizationEntity.fromPrisma(raw);
  }
}
