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
import { SystemModulesService } from './system-modules.service.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { AssignModulesDto } from './dto/assign-modules.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';

@ApiTags('System Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@Controller('system-modules')
export class SystemModulesController {
  constructor(private readonly systemModulesService: SystemModulesService) {}

  /**
   * POST /system-modules
   * Crea un nuevo módulo junto con features y permisos en el catálogo global.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un nuevo módulo (Admin Global Only)',
    description:
      'Crea un módulo en el catálogo global de permisos, incluyendo features y permisos opcionales.',
  })
  @ApiCreatedResponse({ description: 'Módulo creado exitosamente' })
  @ApiBadRequestResponse({ description: 'Llaves duplicadas o payload inválido' })
  async create(@Body() dto: CreateModuleDto) {
    return this.systemModulesService.create(dto);
  }

  /**
   * DELETE /system-modules/:id
   * Elimina un módulo y todas sus features y permisos del catálogo global.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar un módulo del catálogo global (Admin Global Only)',
    description:
      'Elimina un módulo por su ID. Se eliminan en cascada todas las features, permisos y asignaciones a roles.',
  })
  @ApiOkResponse({ description: 'Módulo eliminado exitosamente' })
  @ApiNotFoundResponse({ description: 'Módulo no encontrado' })
  async remove(@Param('id') id: string) {
    return this.systemModulesService.delete(id);
  }

  /**
   * POST /system-modules/organizations/:organizationId/modules
   * Asigna una lista de módulos a una organización.
   */
  @Post('organizations/:organizationId/modules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Asignar módulos a una organización (Admin Global Only)',
    description: 'Relaciona un conjunto de módulos con una organización específica de forma atómica e idempotente.',
  })
  @ApiCreatedResponse({ description: 'Módulos asignados exitosamente' })
  @ApiNotFoundResponse({ description: 'Organización o módulos no encontrados' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos' })
  async assignModules(
    @Param('organizationId') organizationId: string,
    @Body() dto: AssignModulesDto,
  ) {
    return this.systemModulesService.assignModulesToOrganization(organizationId, dto.moduleIds);
  }

  /**
   * DELETE /system-modules/organizations/:organizationId/modules/:moduleId
   * Elimina la asignación de un módulo para una organización.
   */
  @Delete('organizations/:organizationId/modules/:moduleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desasignar un módulo de una organización (Admin Global Only)',
    description: 'Elimina la relación de un módulo con la organización seleccionada.',
  })
  @ApiOkResponse({ description: 'Módulo desasignado exitosamente' })
  @ApiNotFoundResponse({ description: 'Organización o módulo no encontrado' })
  async unassignModule(
    @Param('organizationId') organizationId: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.systemModulesService.unassignModuleFromOrganization(organizationId, moduleId);
  }

  /**
   * GET /system-modules/organizations/:organizationId/modules
   * Obtiene la lista de módulos asignados a una organización.
   */
  @Get('organizations/:organizationId/modules')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar módulos de una organización (Admin Global Only)',
    description: 'Retorna los módulos que están activos y asignados para el inquilino indicado.',
  })
  @ApiOkResponse({ description: 'Listado de módulos de la organización' })
  @ApiNotFoundResponse({ description: 'Organización no encontrada' })
  async getOrgModules(@Param('organizationId') organizationId: string) {
    return this.systemModulesService.getModulesForOrganization(organizationId);
  }

  /**
   * GET /system-modules/modules/:moduleId/organizations
   * Obtiene todas las organizaciones que tienen habilitado un módulo.
   */
  @Get('modules/:moduleId/organizations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar organizaciones asignadas a un módulo (Admin Global Only)',
    description: 'Retorna todos los inquilinos que tienen acceso al módulo indicado.',
  })
  @ApiOkResponse({ description: 'Listado de organizaciones asignadas' })
  @ApiNotFoundResponse({ description: 'Módulo no encontrado' })
  async getModuleOrgs(@Param('moduleId') moduleId: string) {
    return this.systemModulesService.getOrganizationsByModule(moduleId);
  }
}
