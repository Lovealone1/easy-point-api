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
   * Asigna una lista de módulos a una organización, verificando primero su existencia.
   */
  async assignModulesToOrganization(
    organizationId: string,
    moduleIds: string[],
  ): Promise<void> {
    // 1. Validar existencia de la organización
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException(`Organización con ID '${organizationId}' no encontrada.`);
    }

    // 2. Validar existencia de todos los módulos solicitados
    const foundModulesCount = await this.prisma.module.count({
      where: { id: { in: moduleIds } },
    });
    if (foundModulesCount !== moduleIds.length) {
      throw new BadRequestException(
        'Uno o más IDs de módulos proporcionados no existen en el catálogo.',
      );
    }

    // 3. Proceder con la asignación
    await this.systemModulesRepository.assignModules(organizationId, moduleIds);
  }

  /**
   * Elimina la asignación de un módulo para una organización.
   */
  async unassignModuleFromOrganization(
    organizationId: string,
    moduleId: string,
  ): Promise<void> {
    // 1. Validar existencia de la organización
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException(`Organización con ID '${organizationId}' no encontrada.`);
    }

    // 2. Validar existencia del módulo
    const moduleExists = await this.prisma.module.count({
      where: { id: moduleId },
    });
    if (moduleExists === 0) {
      throw new NotFoundException(`Módulo con ID '${moduleId}' no encontrado.`);
    }

    // 3. Eliminar relación
    await this.systemModulesRepository.unassignModule(organizationId, moduleId);
  }

  /**
   * Retorna todos los módulos asignados a una organización.
   */
  async getModulesForOrganization(organizationId: string): Promise<ModuleEntity[]> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException(`Organización con ID '${organizationId}' no encontrada.`);
    }

    return this.systemModulesRepository.getAssignedModules(organizationId);
  }

  /**
   * Retorna todas las organizaciones que tienen asignado un módulo específico.
   */
  async getOrganizationsByModule(moduleId: string): Promise<any[]> {
    const moduleExists = await this.prisma.module.count({
      where: { id: moduleId },
    });
    if (moduleExists === 0) {
      throw new NotFoundException(`Módulo con ID '${moduleId}' no encontrado.`);
    }

    return this.systemModulesRepository.getOrganizationsByModule(moduleId);
  }
}
