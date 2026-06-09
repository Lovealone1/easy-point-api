import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { RolePermissionsRepository } from './role-permissions.repository.js';

@Injectable()
export class RolePermissionsService {
  constructor(
    private readonly rolePermissionsRepository: RolePermissionsRepository,
  ) {}

  async getRolePermissions(roleId: string, organizationId: string): Promise<string[]> {
    const role = await this.rolePermissionsRepository.findRoleByIdAndOrg(
      roleId,
      organizationId,
    );

    if (!role) {
      throw new NotFoundException(`Rol con ID ${roleId} no encontrado`);
    }

    return this.rolePermissionsRepository.getPermissionKeysByRole(roleId, organizationId);
  }

  async assignPermission(
    roleId: string,
    permissionId: string,
    organizationId: string,
  ): Promise<any> {
    const role = await this.rolePermissionsRepository.findRoleByIdAndOrg(
      roleId,
      organizationId,
    );

    if (!role) {
      throw new NotFoundException(`Rol con ID ${roleId} no encontrado`);
    }

    if (role.name === 'OWNER') {
      throw new BadRequestException(
        'El rol OWNER tiene permisos globales irrevocables y no puede ser modificado',
      );
    }

    if (role.isSystemDefault) {
      throw new BadRequestException(
        'No se pueden modificar los permisos de un rol del sistema',
      );
    }

    const permission = await this.rolePermissionsRepository.findPermissionByIdAndOrg(
      permissionId,
      organizationId,
    );

    if (!permission) {
      throw new BadRequestException(
        'El permiso no existe, está inactivo o pertenece a un módulo no habilitado para la organización',
      );
    }

    const existing = await this.rolePermissionsRepository.findRolePermission(
      roleId,
      permissionId,
    );

    if (existing) {
      throw new ConflictException(
        'El permiso ya está asignado a este rol',
      );
    }

    return this.rolePermissionsRepository.assignPermission(
      roleId,
      permissionId,
      organizationId,
    );
  }

  async revokePermission(
    roleId: string,
    permissionId: string,
    organizationId: string,
  ): Promise<void> {
    const role = await this.rolePermissionsRepository.findRoleByIdAndOrg(
      roleId,
      organizationId,
    );

    if (!role) {
      throw new NotFoundException(`Rol con ID ${roleId} no encontrado`);
    }

    if (role.name === 'OWNER') {
      throw new BadRequestException(
        'El rol OWNER tiene permisos globales irrevocables y no puede ser modificado',
      );
    }

    if (role.isSystemDefault) {
      throw new BadRequestException(
        'No se pueden modificar los permisos de un rol del sistema',
      );
    }

    const existing = await this.rolePermissionsRepository.findRolePermission(
      roleId,
      permissionId,
    );

    if (!existing) {
      throw new NotFoundException(
        'Asociación de permiso no encontrada para este rol',
      );
    }

    await this.rolePermissionsRepository.revokePermission(roleId, permissionId);
  }
}

