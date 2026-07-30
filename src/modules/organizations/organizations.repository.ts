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

  /**
   * Creates an organization along with its default roles, module assignments,
   * subscription and role permissions.
   *
   * Runs as a system (cross-tenant) transaction: it bootstraps a brand-new
   * organization whose id cannot possibly match the caller's current tenant
   * context. Under RLS, the `role` lookup below would otherwise return zero
   * rows and the permission wiring would silently do nothing, while the
   * `rolePermission` insert would be rejected by the policy's WITH CHECK.
   *
   * Running it in a single transaction also means a failure part-way through
   * no longer leaves an organization without its roles or permissions.
   */
  async create(
    data: any,
    options?: { moduleIds?: string[]; ownerUserId?: string },
  ): Promise<OrganizationEntity> {
    const { plan: planName, planActiveUntil, ...orgData } = data;
    const requestedPlanName = planName?.toUpperCase() ?? 'FREE';

    return this.prisma.$systemTransaction(async (tx) => {
      // 1. Find or create the plan record
      let planRecord = await tx.plan.findUnique({
        where: { name: requestedPlanName },
      });

      if (!planRecord) {
        planRecord = await tx.plan.create({
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

      // If moduleIds is provided (self-service flow), assign exactly that set
      // (admin defaults + user's 5 picks). Otherwise fall back to the historic
      // behavior of assigning every active module (admin-created orgs).
      const activeModules = options?.moduleIds
        ? options.moduleIds.map((id) => ({ id }))
        : await tx.module.findMany({
            where: { isActive: true },
            select: { id: true },
          });

      const now = new Date();
      // Default period: if free, e.g. 100 years, if paid, 1 month
      const endPeriod = planActiveUntil ?? (requestedPlanName === 'FREE'
        ? new Date(now.getFullYear() + 100, now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()));

      const raw = await tx.organization.create({
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
      const createdRoles = await tx.role.findMany({
        where: { organizationId: raw.id },
      });
      const ownerRole = createdRoles.find((r) => r.name === 'OWNER');
      const adminRole = createdRoles.find((r) => r.name === 'ADMINISTRATOR');

      const allPermissions = await tx.permission.findMany({
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
        await tx.rolePermission.createMany({
          data: rolePermissionsData,
        });
      }

      // Self-service flow: the creating user becomes OWNER of their own org.
      if (options?.ownerUserId && ownerRole) {
        await tx.organizationUser.create({
          data: {
            userId: options.ownerUserId,
            organizationId: raw.id,
            roleId: ownerRole.id,
          },
        });
      }

      return OrganizationEntity.fromPrisma(raw);
    });
  }

  /**
   * Counts the organizations a user belongs to. Runs as a system transaction
   * because OrganizationUser is tenant-aware — without a tenant in context
   * (which a brand-new/org-less user never has) the Prisma RLS extension
   * would silently scope the count to zero rows regardless of reality.
   */
  async countMembershipsForUser(userId: string): Promise<number> {
    return this.prisma.$systemTransaction((tx) =>
      tx.organizationUser.count({ where: { userId } }),
    );
  }

  /**
   * Returns all active modules from the global catalog. `Module` is not
   * tenant-aware, so this is a plain read.
   */
  async findActiveModules(): Promise<
    Array<{
      id: string;
      key: string;
      name: string;
      description: string | null;
      icon: string | null;
      sortOrder: number;
    }>
  > {
    return this.prisma.module.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        icon: true,
        sortOrder: true,
      },
    });
  }

  /**
   * Resolves a unique organization slug, appending `-2`, `-3`, ... when the
   * base slug is already taken (self-service orgs commonly collide on names
   * like "Mi Tienda"). Runs as a system transaction since it must be able to
   * see every organization's slug, not just the caller's tenant.
   */
  async resolveUniqueSlug(base: string): Promise<string> {
    return this.prisma.$systemTransaction(async (tx) => {
      let candidate = base;
      let suffix = 2;

      while (await tx.organization.findUnique({ where: { slug: candidate } })) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
      }

      return candidate;
    });
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
