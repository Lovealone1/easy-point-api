import {
  Controller,
  Post,
  Delete,
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
}
