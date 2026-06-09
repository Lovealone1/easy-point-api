import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PermissionsRepository } from './permissions.repository.js';
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
      await this.permissionsRepository.getPermissionKeysByRole(orgUser.roleId, organizationId);

    return { permissions, isSystemRole: false };
  }
}
