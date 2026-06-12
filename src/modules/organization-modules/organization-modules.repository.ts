import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ModuleEntity } from '../permissions/domain/module.entity.js';
import { FeatureEntity } from '../permissions/domain/feature.entity.js';
import { PermissionEntity } from '../permissions/domain/permission.entity.js';

@Injectable()
export class OrganizationModulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca si ya existe la relación de asignación entre módulo y organización.
   */
  async findAssignment(organizationId: string, moduleId: string) {
    return this.prisma.organizationModule.findUnique({
      where: {
        organizationId_moduleId: {
          organizationId,
          moduleId,
        },
      },
      include: {
        module: true,
      },
    });
  }

  /**
   * Crea la relación de asignación entre módulo y organización.
   */
  async assign(organizationId: string, moduleId: string) {
    return this.prisma.organizationModule.create({
      data: {
        organizationId,
        moduleId,
      },
      include: {
        module: true,
      },
    });
  }

  /**
   * Elimina la relación de asignación.
   */
  async unassign(organizationId: string, moduleId: string): Promise<void> {
    await this.prisma.organizationModule.delete({
      where: {
        organizationId_moduleId: {
          organizationId,
          moduleId,
        },
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
   * Obtiene la lista de organizaciones asignadas a un módulo específico.
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
