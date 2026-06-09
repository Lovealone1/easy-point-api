import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { PermissionsService } from './permissions.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Permissions')
@ApiSecurity('x-organization-id')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  private getOrgIdOrThrow(): string {
    const orgId = getTenantId();
    if (!orgId) throw new BadRequestException('Organization context is missing');
    return orgId;
  }

  /**
   * GET /permissions/catalog
   * Devuelve el árbol completo Módulo > Feature > Permission.
   * Accesible solo por OWNER y ADMINISTRATOR (para el UI de edición de roles).
   */
  @Get('catalog')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('permissions:read')
  @ApiOperation({
    summary: 'Obtener catálogo completo de módulos, features y permisos',
    description:
      'Devuelve la jerarquía completa de permisos disponibles en el sistema. Úsalo para renderizar el UI de asignación de permisos a roles.',
  })
  @ApiOkResponse({ description: 'Catálogo de permisos' })
  async getCatalog() {
    return this.permissionsService.getCatalog();
  }

  /**
   * GET /permissions/my-permissions
   * Devuelve los permission keys del usuario autenticado.
   * Úsado por el frontend al iniciar sesión para construir el contexto de permisos.
   */
  @Get('my-permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener mis permisos en la organización actual',
    description:
      'Devuelve el array de permission keys del usuario autenticado. Si es un rol sistema (OWNER/ADMINISTRATOR), retorna ["*"] y isSystemRole: true.',
  })
  @ApiOkResponse({
    description: 'Permisos del usuario',
    schema: {
      example: {
        permissions: ['sales:create', 'sales:read', 'clients:read'],
        isSystemRole: false,
      },
    },
  })
  async getMyPermissions(@CurrentUser() user: any) {
    return this.permissionsService.getMyPermissions(
      user?.sub || user?.id,
      this.getOrgIdOrThrow(),
    );
  }
}
