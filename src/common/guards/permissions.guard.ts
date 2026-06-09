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
import { GlobalRole, OrganizationStatus } from '@prisma/client';
import { Role } from '../enums/role.enum.js';
import { getTenantId } from '../context/tenant.context.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import {
  ROLE_DIRTY_PREFIX,
} from '../../infraestructure/redis/role-dirty.constants.js';

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
    private readonly redisCacheService: RedisCacheService,
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

    // Cargar el orgUser con su rol e información de la organización
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: {
        role: {
          select: { name: true, isSystemDefault: true },
        },
        organization: {
          select: { status: true, isActive: true },
        },
      },
    });

    if (!orgUser || !orgUser.organization) {
      throw new ForbiddenException('No perteneces a esta organización');
    }

    // Validar que la organización esté activa
    if (
      orgUser.organization.status !== OrganizationStatus.ACTIVE ||
      !orgUser.organization.isActive
    ) {
      throw new ForbiddenException('Esta organización está actualmente inactiva o suspendida');
    }

    // Verificar que los módulos correspondientes a los permisos requeridos estén habilitados para la org
    const enabledModulesCount = await this.prisma.permission.count({
      where: {
        key: { in: requiredKeys },
        isActive: true,
        feature: {
          isActive: true,
          module: {
            isActive: true,
            organizationModules: {
              some: {
                organizationId,
              },
            },
          },
        },
      },
    });

    if (enabledModulesCount < requiredKeys.length) {
      throw new ForbiddenException(
        'Uno o más módulos requeridos para esta acción no están habilitados en su organización',
      );
    }

    // ── Dirty flag check ─────────────────────────────────────────────────────
    // Detecta si el rol del usuario fue modificado DESPUÉS de que se emitió
    // el token JWT actual. Si el dirty flag es más reciente que token.iat,
    // el usuario tiene permisos desactualizados → forzar re-login.
    //
    // Nota: esto aplica solo a roles no-sistema (OWNER/ADMINISTRATOR tienen
    // bypass a continuación y sus permisos son irrevocables).
    const dirtyTimestamp = await this.redisCacheService.get<number>(
      `${ROLE_DIRTY_PREFIX}${orgUser.roleId}`,
    );

    if (dirtyTimestamp) {
      // token.iat está en segundos Unix; dirtyTimestamp en milisegundos
      const tokenIssuedAtMs = ((user as any).iat ?? 0) * 1000;
      if (dirtyTimestamp > tokenIssuedAtMs) {
        throw new UnauthorizedException(
          'Tus permisos han sido modificados. Por favor, vuelve a iniciar sesión para continuar.',
        );
      }
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
