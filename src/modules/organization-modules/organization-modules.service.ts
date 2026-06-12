import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrganizationModulesRepository } from './organization-modules.repository.js';
import { ModuleEntity } from '../permissions/domain/module.entity.js';

@Injectable()
export class OrganizationModulesService {
  constructor(
    private readonly repository: OrganizationModulesRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Asigna un módulo a una organización.
   * Si ya estaba asignado, lo maneja de forma idempotente.
   */
  async assignModule(organizationId: string, moduleId: string) {
    // 1. Validar existencia de la organización
    const orgExists = await this.prisma.organization.count({
      where: { id: organizationId },
    });
    if (orgExists === 0) {
      throw new NotFoundException(`Organización con ID '${organizationId}' no encontrada.`);
    }

    // 2. Validar existencia del módulo
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });
    if (!module) {
      throw new NotFoundException(`Módulo con ID '${moduleId}' no encontrado.`);
    }

    // 3. Verificar si ya está asignado
    const existing = await this.repository.findAssignment(organizationId, moduleId);
    if (existing) {
      return {
        message: 'El módulo ya está asignado a la organización.',
        data: existing,
      };
    }

    // 4. Crear asignación
    const assignment = await this.repository.assign(organizationId, moduleId);
    return {
      message: 'Módulo asignado exitosamente.',
      data: assignment,
    };
  }

  /**
   * Elimina la asignación de un módulo para una organización.
   */
  async unassignModule(organizationId: string, moduleId: string): Promise<void> {
    // 1. Validar existencia de la organización
    const orgExists = await this.prisma.organization.count({
      where: { id: organizationId },
    });
    if (orgExists === 0) {
      throw new NotFoundException(`Organización con ID '${organizationId}' no encontrada.`);
    }

    // 2. Validar existencia del módulo
    const moduleExists = await this.prisma.module.count({
      where: { id: moduleId },
    });
    if (moduleExists === 0) {
      throw new NotFoundException(`Módulo con ID '${moduleId}' no encontrado.`);
    }

    // 3. Verificar si la relación existe antes de borrar
    const existing = await this.repository.findAssignment(organizationId, moduleId);
    if (!existing) {
      throw new NotFoundException(
        `La asignación del módulo con ID '${moduleId}' para la organización con ID '${organizationId}' no existe.`,
      );
    }

    // 4. Proceder a eliminar
    await this.repository.unassign(organizationId, moduleId);
  }

  /**
   * Retorna todos los módulos asignados a una organización.
   */
  async getModulesForOrganization(organizationId: string): Promise<ModuleEntity[]> {
    const orgExists = await this.prisma.organization.count({
      where: { id: organizationId },
    });
    if (orgExists === 0) {
      throw new NotFoundException(`Organización con ID '${organizationId}' no encontrada.`);
    }

    return this.repository.getAssignedModules(organizationId);
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

    return this.repository.getOrganizationsByModule(moduleId);
  }
}
