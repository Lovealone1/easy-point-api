import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GlobalRole } from '@prisma/client';
import { Role } from '../enums/role.enum.js';
import { getTenantId } from '../context/tenant.context.js';

/**
 * Guard de permisos granular.
 *
 * Jerarquía de acceso:
 * 1. Global Admin (GlobalRole.ADMIN) → bypass total
 * 2. Roles sistema de org (OWNER, ADMINISTRATOR, isSystemDefault=true) → bypass total
 * 3. Cualquier otro rol → verifica que tenga el permiso en RolePermission
 *
 * Debe usarse SIEMPRE junto con JwtAuthGuard (que setea request.user).
 *
 * Uso en controller:
 *   @UseGuards(JwtAuthGuard, PermissionsGuard)
 *   @RequirePermission('sales:create')
 *   async create(...) {}
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredKeys = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay @RequirePermission en el endpoint, se permite (guard no aplica)
    if (!requiredKeys || requiredKeys.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    // 1. Bypass: Global Admin
    if (user.role === GlobalRole.ADMIN) {
      return true;
    }

    const userId = user.sub || user.id;
    const organizationId = getTenantId();

    if (!organizationId) {
      throw new ForbiddenException('Contexto de organización no encontrado');
    }

    // Cargar el orgUser con su rol
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: {
        role: {
          select: { name: true, isSystemDefault: true },
        },
      },
    });

    if (!orgUser) {
      throw new ForbiddenException('No perteneces a esta organización');
    }

    // 2. Bypass: Roles sistema (OWNER, ADMINISTRATOR)
    if (
      orgUser.role.isSystemDefault &&
      [Role.OWNER, Role.ADMINISTRATOR].includes(orgUser.role.name as Role)
    ) {
      return true;
    }

    // 3. Verificar permisos granulares en DB
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        roleId: orgUser.roleId,
        permission: {
          key: { in: requiredKeys },
          isActive: true,
        },
      },
      select: { permission: { select: { key: true } } },
    });

    const grantedKeys = new Set(rolePermissions.map((rp) => rp.permission.key));

    // El usuario debe tener TODOS los permisos requeridos
    const missingKeys = requiredKeys.filter((k) => !grantedKeys.has(k));

    if (missingKeys.length > 0) {
      throw new ForbiddenException(
        `No tienes los permisos necesarios para realizar esta acción: ${missingKeys.join(', ')}`,
      );
    }

    return true;
  }
}
