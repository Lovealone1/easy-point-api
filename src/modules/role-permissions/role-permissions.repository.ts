import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class RolePermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRoleByIdAndOrg(roleId: string, organizationId: string) {
    return this.prisma.role.findFirst({
      where: {
        id: roleId,
        organizationId,
      },
    });
  }

  async getPermissionKeysByRole(roleId: string, organizationId: string): Promise<string[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        roleId,
        organizationId,
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
      },
      select: {
        permission: {
          select: {
            key: true,
          },
        },
      },
    });

    return rolePermissions.map((rp) => rp.permission.key);
  }

  async findPermissionByIdAndOrg(permissionId: string, organizationId: string) {
    return this.prisma.permission.findFirst({
      where: {
        id: permissionId,
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
    });
  }

  async findRolePermission(roleId: string, permissionId: string) {
    return this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });
  }

  async assignPermission(roleId: string, permissionId: string, organizationId: string) {
    return this.prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
        organizationId,
      },
    });
  }

  async revokePermission(roleId: string, permissionId: string) {
    return this.prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });
  }
}

