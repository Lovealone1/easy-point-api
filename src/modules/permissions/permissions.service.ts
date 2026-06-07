import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PermissionsRepository } from './permissions.repository.js';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto.js';
import { ModuleEntity } from './domain/module.entity.js';
import { Role } from '../../common/enums/role.enum.js';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly permissionsRepository: PermissionsRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Devuelve el catálogo completo de módulos/features/permisos.
   * Úsalo para renderizar el UI de asignación de permisos.
   */
  async getCatalog(): Promise<ModuleEntity[]> {
    return this.permissionsRepository.getCatalog();
  }

  /**
   * Devuelve los permission keys del usuario autenticado en la organización actual.
   * Roles sistema (OWNER, ADMINISTRATOR) retornan wildcard '*' para bypass total.
   */
  async getMyPermissions(
    userId: string,
    organizationId: string,
  ): Promise<{ permissions: string[]; isSystemRole: boolean }> {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { role: { select: { name: true, isSystemDefault: true } } },
    });

    if (!orgUser) {
      throw new NotFoundException('El usuario no pertenece a esta organización');
    }

    // Los roles sistema tienen acceso total — el frontend puede usar isSystemRole
    // para renderizar la UI sin restricciones
    const isSystemRole =
      orgUser.role.isSystemDefault &&
      [Role.OWNER, Role.ADMINISTRATOR].includes(orgUser.role.name as Role);

    if (isSystemRole) {
      return { permissions: ['*'], isSystemRole: true };
    }

    const permissions =
      await this.permissionsRepository.getPermissionKeysByRole(orgUser.roleId);

    return { permissions, isSystemRole: false };
  }

  /**
   * Devuelve los permisos de un rol específico (para el UI de edición de roles).
   */
  async getRolePermissions(
    roleId: string,
    organizationId: string,
  ): Promise<string[]> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId },
    });

    if (!role) {
      throw new NotFoundException(`Rol con ID ${roleId} no encontrado`);
    }

    return this.permissionsRepository.getPermissionKeysByRole(roleId);
  }

  /**
   * Asigna un conjunto de permisos a un rol (reemplaza los existentes).
   * Valida que todas las keys existan en el catálogo antes de asignar.
   */
  async setRolePermissions(
    roleId: string,
    organizationId: string,
    dto: SetRolePermissionsDto,
  ): Promise<{ assigned: number; permissionKeys: string[] }> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId },
    });

    if (!role) {
      throw new NotFoundException(`Rol con ID ${roleId} no encontrado`);
    }

    if (role.isSystemDefault) {
      throw new BadRequestException(
        'No se pueden modificar los permisos de un rol del sistema',
      );
    }

    // Validar que todos los keys existen en el catálogo
    const foundPermissions =
      await this.permissionsRepository.findPermissionsByKeys(dto.permissionKeys);

    const foundKeys = new Set(foundPermissions.map((p) => p.key));
    const invalidKeys = dto.permissionKeys.filter((k) => !foundKeys.has(k));

    if (invalidKeys.length > 0) {
      throw new BadRequestException(
        `Los siguientes permission keys no existen o están inactivos: ${invalidKeys.join(', ')}`,
      );
    }

    await this.permissionsRepository.setRolePermissions(
      roleId,
      organizationId,
      dto.permissionKeys,
    );

    return {
      assigned: dto.permissionKeys.length,
      permissionKeys: dto.permissionKeys,
    };
  }
}
