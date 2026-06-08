import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ModuleEntity } from '../permissions/domain/module.entity.js';
import { FeatureEntity } from '../permissions/domain/feature.entity.js';
import { PermissionEntity } from '../permissions/domain/permission.entity.js';

@Injectable()
export class SystemModulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un nuevo módulo junto con sus features y permisos opcionales.
   */
  async create(data: any): Promise<ModuleEntity> {
    const { features, ...moduleData } = data;

    const createdModule = await this.prisma.module.create({
      data: {
        ...moduleData,
        features: features
          ? {
              create: features.map((f: any) => {
                const { permissions, ...featureData } = f;
                return {
                  ...featureData,
                  permissions: permissions
                    ? {
                        create: permissions,
                      }
                    : undefined,
                };
              }),
            }
          : undefined,
      },
      include: {
        features: {
          include: {
            permissions: true,
          },
        },
      },
    });

    return ModuleEntity.fromPrisma(
      createdModule,
      createdModule.features.map((f) =>
        FeatureEntity.fromPrisma(
          f,
          f.permissions.map(PermissionEntity.fromPrisma),
        ),
      ),
    );
  }

  /**
   * Elimina un módulo por su ID (cascada automática a features y permisos).
   */
  async delete(id: string): Promise<ModuleEntity> {
    const deletedModule = await this.prisma.module.delete({
      where: { id },
      include: {
        features: {
          include: {
            permissions: true,
          },
        },
      },
    });

    return ModuleEntity.fromPrisma(
      deletedModule,
      deletedModule.features.map((f) =>
        FeatureEntity.fromPrisma(
          f,
          f.permissions.map(PermissionEntity.fromPrisma),
        ),
      ),
    );
  }

  /**
   * Busca un módulo por ID.
   */
  async findById(id: string): Promise<ModuleEntity | null> {
    const module = await this.prisma.module.findUnique({
      where: { id },
      include: {
        features: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!module) return null;

    return ModuleEntity.fromPrisma(
      module,
      module.features.map((f) =>
        FeatureEntity.fromPrisma(
          f,
          f.permissions.map(PermissionEntity.fromPrisma),
        ),
      ),
    );
  }

  /**
   * Asigna un conjunto de módulos a una organización (idempotente).
   */
  async assignModules(organizationId: string, moduleIds: string[]): Promise<void> {
    await this.prisma.organizationModule.createMany({
      data: moduleIds.map((moduleId) => ({
        organizationId,
        moduleId,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Desasigna un módulo específico de una organización.
   */
  async unassignModule(organizationId: string, moduleId: string): Promise<void> {
    await this.prisma.organizationModule.deleteMany({
      where: {
        organizationId,
        moduleId,
      },
    });
  }

  /**
   * Obtiene la lista de módulos asignados a una organización específica.
   */
  async getAssignedModules(organizationId: string): Promise<ModuleEntity[]> {
    const orgModules = await this.prisma.organizationModule.findMany({
      where: { organizationId },
      include: {
        module: {
          include: {
            features: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
      orderBy: {
        module: {
          sortOrder: 'asc',
        },
      },
    });

    return orgModules.map((om) =>
      ModuleEntity.fromPrisma(
        om.module,
        om.module.features.map((f) =>
          FeatureEntity.fromPrisma(
            f,
            f.permissions.map(PermissionEntity.fromPrisma),
          ),
        ),
      ),
    );
  }

  /**
   * Obtiene la lista de organizaciones que tienen asignado un módulo específico.
   */
  async getOrganizationsByModule(moduleId: string): Promise<any[]> {
    const orgModules = await this.prisma.organizationModule.findMany({
      where: { moduleId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
      },
    });
    return orgModules.map((om) => om.organization);
  }
}
