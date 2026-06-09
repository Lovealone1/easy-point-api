import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { RolePermissionsRepository } from './role-permissions.repository.js';
import { AuditService } from '../../infraestructure/audit/audit.service.js';
import { AuditAction } from '../../infraestructure/audit/enums/audit-action.enum.js';
import { AuditSeverity } from '../../infraestructure/audit/enums/audit-severity.enum.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import {
  ROLE_DIRTY_PREFIX,
  ROLE_DIRTY_TTL_SECONDS,
} from '../../infraestructure/redis/role-dirty.constants.js';

@Injectable()
export class RolePermissionsService {
  constructor(
    private readonly rolePermissionsRepository: RolePermissionsRepository,
    private readonly auditService: AuditService,
    private readonly redisCacheService: RedisCacheService,
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

    const result = await this.rolePermissionsRepository.assignPermission(
      roleId,
      permissionId,
      organizationId,
    );

    // ── Auditoría ──────────────────────────────────────────────────────────────
    this.auditService.log({
      action: AuditAction.PERMISSION_CHANGE,
      resourceType: 'RolePermission',
      resourceId: roleId,
      metadata: { operation: 'ASSIGN', permissionId, organizationId, roleName: role.name },
      severity: AuditSeverity.HIGH,
    });

    // ── Dirty flag: marcar el rol como modificado para invalidar tokens viejos ──
    await this.redisCacheService.set(
      `${ROLE_DIRTY_PREFIX}${roleId}`,
      Date.now(),
      ROLE_DIRTY_TTL_SECONDS,
    );

    return result;
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

    // ── Auditoría ──────────────────────────────────────────────────────────────
    this.auditService.log({
      action: AuditAction.PERMISSION_CHANGE,
      resourceType: 'RolePermission',
      resourceId: roleId,
      metadata: { operation: 'REVOKE', permissionId, organizationId, roleName: role.name },
      severity: AuditSeverity.HIGH,
    });

    // ── Dirty flag: marcar el rol como modificado para invalidar tokens viejos ──
    await this.redisCacheService.set(
      `${ROLE_DIRTY_PREFIX}${roleId}`,
      Date.now(),
      ROLE_DIRTY_TTL_SECONDS,
    );
  }
}
