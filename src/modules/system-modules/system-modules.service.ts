import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SystemModulesRepository } from './system-modules.repository.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { ModuleEntity } from '../permissions/domain/module.entity.js';

@Injectable()
export class SystemModulesService {
  constructor(
    private readonly systemModulesRepository: SystemModulesRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Crea un nuevo módulo en el catálogo global de permisos.
   * Valida que no haya llaves de módulo, features o permisos duplicadas.
   */
  async create(dto: CreateModuleDto): Promise<ModuleEntity> {
    // 1. Validar que la key del módulo no exista
    const existingModule = await this.prisma.module.findUnique({
      where: { key: dto.key },
    });
    if (existingModule) {
      throw new BadRequestException(`El módulo con la key '${dto.key}' ya existe.`);
    }

    // 2. Validar que las keys de features y permisos no estén duplicadas y no existan
    if (dto.features && dto.features.length > 0) {
      const featureKeys = dto.features.map((f) => f.key);
      const existingFeatures = await this.prisma.feature.findMany({
        where: { key: { in: featureKeys } },
      });
      if (existingFeatures.length > 0) {
        const dupKeys = existingFeatures.map((f) => f.key).join(', ');
        throw new BadRequestException(
          `Las siguientes feature keys ya existen en el sistema: ${dupKeys}`,
        );
      }

      const permissionKeys = dto.features.flatMap(
        (f) => f.permissions?.map((p) => p.key) || [],
      );
      if (permissionKeys.length > 0) {
        const existingPermissions = await this.prisma.permission.findMany({
          where: { key: { in: permissionKeys } },
        });
        if (existingPermissions.length > 0) {
          const dupKeys = existingPermissions.map((p) => p.key).join(', ');
          throw new BadRequestException(
            `Las siguientes permission keys ya existen en el sistema: ${dupKeys}`,
          );
        }
      }
    }

    return this.systemModulesRepository.create(dto);
  }

  /**
   * Elimina un módulo del catálogo global por su ID (cascada a features/permisos).
   */
  async delete(id: string): Promise<ModuleEntity> {
    const existing = await this.systemModulesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Módulo con ID ${id} no encontrado`);
    }

    return this.systemModulesRepository.delete(id);
  }

  /**
   * Obtiene todos los módulos del catálogo global, opcionalmente filtrados por isActive.
   */
  async findAll(isActive?: boolean): Promise<ModuleEntity[]> {
    const filter = isActive !== undefined ? { isActive } : undefined;
    return this.systemModulesRepository.findAll(filter);
  }

  /**
   * Modifica el estado activo/inactivo de un módulo global.
   */
  async toggleActive(id: string, isActive: boolean): Promise<ModuleEntity> {
    const existing = await this.systemModulesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Módulo con ID '${id}' no encontrado.`);
    }

    return this.systemModulesRepository.updateActive(id, isActive);
  }
}
