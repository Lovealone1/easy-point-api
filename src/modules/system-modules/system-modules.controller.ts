import {
  Controller,
  Post,
  Delete,
  Get,
  Patch,
  Param,
  Body,
  Query,
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
import { FindSystemModulesDto } from './dto/find-system-modules.dto.js';
import { ToggleModuleDto } from './dto/toggle-module.dto.js';
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
   * GET /system-modules
   * Lista todos los módulos del catálogo global con sus features y permisos.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar módulos del catálogo global (Admin Global Only)',
    description: 'Devuelve todos los módulos registrados, opcionalmente filtrados por isActive.',
  })
  @ApiOkResponse({ description: 'Listado de módulos del catálogo global' })
  async findAll(@Query() query: FindSystemModulesDto) {
    return this.systemModulesService.findAll(query.isActive);
  }

  /**
   * PATCH /system-modules/:id/toggle
   * Habilita o deshabilita un módulo del catálogo global.
   */
  @Patch(':id/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Habilitar/deshabilitar un módulo (Admin Global Only)',
    description: 'Actualiza el estado isActive de un módulo específico.',
  })
  @ApiOkResponse({ description: 'Módulo actualizado exitosamente' })
  @ApiNotFoundResponse({ description: 'Módulo no encontrado' })
  async toggle(@Param('id') id: string, @Body() dto: ToggleModuleDto) {
    return this.systemModulesService.toggleActive(id, dto.isActive);
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
}
