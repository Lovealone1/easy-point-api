import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { OrganizationModulesService } from './organization-modules.service.js';
import { AssignOrganizationModuleDto } from './dto/assign-organization-module.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GlobalRole } from '@prisma/client';

@ApiTags('Organization Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organization-modules')
export class OrganizationModulesController {
  constructor(
    private readonly service: OrganizationModulesService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /organization-modules
   * Asigna un módulo a una organización de forma atómica e idempotente.
   */
  @Post()
  @Roles(GlobalRole.ADMIN)
  @HttpCode(HttpStatus.OK) // Usamos 200 OK para soportar el comportamiento idempotente
  @ApiOperation({
    summary: 'Asignar un módulo a una organización (Admin Global Only)',
    description: 'Relaciona un módulo con una organización de forma atómica e idempotente.',
  })
  @ApiOkResponse({ description: 'Módulo asignado o ya asignado previamente' })
  @ApiNotFoundResponse({ description: 'Organización o módulo no encontrado' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos' })
  async assign(@Body() dto: AssignOrganizationModuleDto) {
    return this.service.assignModule(dto.organizationId, dto.moduleId);
  }

  /**
   * DELETE /organization-modules/:organizationId/:moduleId
   * Elimina la asignación de un módulo para una organización.
   */
  @Delete(':organizationId/:moduleId')
  @Roles(GlobalRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desasignar un módulo de una organización (Admin Global Only)',
    description: 'Elimina la relación de un módulo con la organización seleccionada.',
  })
  @ApiOkResponse({ description: 'Módulo desasignado exitosamente' })
  @ApiNotFoundResponse({ description: 'Organización, módulo o asignación no encontrada' })
  async unassign(
    @Param('organizationId') organizationId: string,
    @Param('moduleId') moduleId: string,
  ) {
    await this.service.unassignModule(organizationId, moduleId);
    return { message: 'Módulo desasignado exitosamente' };
  }

  /**
   * GET /organization-modules/:organizationId
   * Obtiene la lista de módulos asignados a una organización.
   */
  @Get(':organizationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar módulos de una organización (Admin o Miembros)',
    description: 'Retorna los módulos que están activos y asignados para el inquilino indicado.',
  })
  @ApiOkResponse({ description: 'Listado de módulos de la organización' })
  @ApiNotFoundResponse({ description: 'Organización no encontrada' })
  async getOrgModules(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    // Permit access if user is Global Admin
    if (user.role === GlobalRole.ADMIN) {
      return this.service.getModulesForOrganization(organizationId);
    }
    // Otherwise, check if user is a member of this organization
    const membership = await this.prisma.organizationUser.count({
      where: { userId: user.sub || user.id, organizationId },
    });
    if (membership === 0) {
      throw new ForbiddenException('No tienes acceso a esta organización.');
    }
    return this.service.getModulesForOrganization(organizationId);
  }

  /**
   * GET /organization-modules/by-module/:moduleId
   * Obtiene todas las organizaciones que tienen habilitado un módulo.
   */
  @Get('by-module/:moduleId')
  @Roles(GlobalRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar organizaciones asignadas a un módulo (Admin Global Only)',
    description: 'Retorna todos los inquilinos que tienen acceso al módulo indicado.',
  })
  @ApiOkResponse({ description: 'Listado de organizaciones asignadas' })
  @ApiNotFoundResponse({ description: 'Módulo no encontrado' })
  async getModuleOrgs(@Param('moduleId') moduleId: string) {
    return this.service.getOrganizationsByModule(moduleId);
  }
}
