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
}
