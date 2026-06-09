import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { RolePermissionsService } from './role-permissions.service.js';
import { AssignRolePermissionDto } from './dto/assign-role-permission.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { getTenantId } from '../../common/context/tenant.context.js';

@ApiTags('Role Permissions')
@ApiSecurity('x-organization-id')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('role-permissions')
export class RolePermissionsController {
  constructor(
    private readonly rolePermissionsService: RolePermissionsService,
  ) {}

  private getOrgIdOrThrow(): string {
    const orgId = getTenantId();
    if (!orgId) {
      throw new BadRequestException('Organization context is missing');
    }
    return orgId;
  }

  @Get(':roleId')
  @RequirePermission('role_permissions:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener permisos de un rol específico en la organización actual' })
  @ApiOkResponse({ description: 'Permission keys del rol' })
  @ApiNotFoundResponse({ description: 'Rol no encontrado' })
  async getRolePermissions(@Param('roleId') roleId: string) {
    return this.rolePermissionsService.getRolePermissions(
      roleId,
      this.getOrgIdOrThrow(),
    );
  }

  @Post()
  @RequirePermission('role_permissions:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Asignar un permiso a un rol de la organización actual',
  })
  @ApiCreatedResponse({ description: 'Permiso asignado exitosamente' })
  @ApiNotFoundResponse({ description: 'Rol no encontrado' })
  @ApiBadRequestResponse({
    description: 'Rol de sistema no modificable o permiso inválido/no asignado al tenant',
  })
  async assignPermission(@Body() dto: AssignRolePermissionDto) {
    return this.rolePermissionsService.assignPermission(
      dto.roleId,
      dto.permissionId,
      this.getOrgIdOrThrow(),
    );
  }

  @Delete(':roleId/:permissionId')
  @RequirePermission('role_permissions:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revocar un permiso de un rol de la organización actual',
  })
  @ApiOkResponse({ description: 'Permiso revocado exitosamente' })
  @ApiNotFoundResponse({ description: 'Asociación de permiso no encontrada' })
  @ApiBadRequestResponse({
    description: 'Rol de sistema no modificable',
  })
  async revokePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.rolePermissionsService.revokePermission(
      roleId,
      permissionId,
      this.getOrgIdOrThrow(),
    );
    return { message: 'Permiso revocado exitosamente' };
  }
}
