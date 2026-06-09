import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ModuleEntity } from './domain/module.entity.js';
import { FeatureEntity } from './domain/feature.entity.js';
import { PermissionEntity } from './domain/permission.entity.js';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve el catálogo completo: Módulos > Features > Permisos
   * Solo permisos activos, ordenados por sortOrder.
   */
  async getCatalog(): Promise<ModuleEntity[]> {
    const modules = await this.prisma.module.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        features: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            permissions: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    return modules.map((m) =>
      ModuleEntity.fromPrisma(m, m.features.map((f) =>
        FeatureEntity.fromPrisma(f, f.permissions.map(PermissionEntity.fromPrisma)),
      )),
    );
  }

  /**
   * Devuelve los permission keys asignados a un rol en una organización.
   * Si se provee organizationId, filtra solo los permisos de los módulos activos para la org.
   */
  async getPermissionKeysByRole(roleId: string, organizationId?: string): Promise<string[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        roleId,
        ...(organizationId && {
          permission: {
            isActive: true,
            feature: {
              isActive: true,
              module: {
                isActive: true,
                organizationModules: {
                  some: {
                    organizationId,
                  },
                },
              },
            },
          },
        }),
      },
      include: { permission: { select: { key: true, isActive: true } } },
    });

    return rolePermissions
      .filter((rp) => rp.permission.isActive)
      .map((rp) => rp.permission.key);
  }

  /**
   * Devuelve los permission keys de todos los roles activos del usuario en la org.
   * Usado para construir el mapa de permisos en el JWT o en /my-permissions.
   */
  async getPermissionKeysByOrgUser(
    userId: string,
    organizationId: string,
  ): Promise<string[]> {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      select: { roleId: true },
    });

    if (!orgUser) return [];

    return this.getPermissionKeysByRole(orgUser.roleId, organizationId);
  }

  /**
   * Verifica si una permission key existe en el catálogo (validación antes de asignar).
   */
  async findPermissionsByKeys(keys: string[]): Promise<PermissionEntity[]> {
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: keys }, isActive: true },
    });
    return permissions.map(PermissionEntity.fromPrisma);
  }
}
