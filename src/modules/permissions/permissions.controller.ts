import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { PermissionsService } from './permissions.service.js';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { getTenantId } from '../../common/context/tenant.context.js';

@ApiTags('Permissions')
@ApiSecurity('x-organization-id')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgRolesGuard)
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
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
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
  async getMyPermissions(@Req() request: Request) {
    // Extraemos el user del JWT — disponible gracias al JwtAuthGuard
    const user = request.user as any;
    return this.permissionsService.getMyPermissions(
      user?.sub || user?.id,
      this.getOrgIdOrThrow(),
    );
  }

  /**
   * GET /permissions/roles/:roleId
   * Devuelve los permission keys actuales de un rol.
   */
  @Get('roles/:roleId')
  @HttpCode(HttpStatus.OK)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiOperation({ summary: 'Obtener permisos de un rol específico' })
  @ApiOkResponse({ description: 'Permission keys del rol' })
  @ApiNotFoundResponse({ description: 'Rol no encontrado' })
  async getRolePermissions(@Param('roleId') roleId: string) {
    return this.permissionsService.getRolePermissions(
      roleId,
      this.getOrgIdOrThrow(),
    );
  }

  /**
   * PUT /permissions/roles/:roleId
   * Asigna el conjunto completo de permisos a un rol (reemplaza los existentes).
   */
  @Put('roles/:roleId')
  @HttpCode(HttpStatus.OK)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Asignar permisos a un rol',
    description:
      'Reemplaza atómicamente todos los permisos del rol con el nuevo set proporcionado.',
  })
  @ApiOkResponse({ description: 'Permisos asignados exitosamente' })
  @ApiNotFoundResponse({ description: 'Rol no encontrado' })
  @ApiBadRequestResponse({
    description: 'Rol sistema no modificable o keys inválidas',
  })
  async setRolePermissions(
    @Param('roleId') roleId: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.permissionsService.setRolePermissions(
      roleId,
      this.getOrgIdOrThrow(),
      dto,
    );
  }
}
