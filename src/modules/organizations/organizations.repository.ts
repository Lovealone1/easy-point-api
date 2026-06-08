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
    data: Prisma.OrganizationCreateInput,
  ): Promise<OrganizationEntity> {
    const activeModules = await this.prisma.module.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const raw = await this.prisma.organization.create({
      data: {
        ...data,
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
      this.prisma.organization.findMany({ skip, take, where, orderBy }),
      this.prisma.organization.count({ where }),
    ]);
    return [rows.map(OrganizationEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<OrganizationEntity | null> {
    const raw = await this.prisma.organization.findUnique({ where: { id } });
    return raw ? OrganizationEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.OrganizationUpdateInput,
  ): Promise<OrganizationEntity> {
    const raw = await this.prisma.organization.update({ where: { id }, data });
    return OrganizationEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<OrganizationEntity> {
    const raw = await this.prisma.organization.delete({ where: { id } });
    return OrganizationEntity.fromPrisma(raw);
  }
}
