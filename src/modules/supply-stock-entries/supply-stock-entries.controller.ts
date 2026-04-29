import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SupplyStockEntriesService } from './supply-stock-entries.service.js';
import { CreateSupplyStockEntryDto } from './dto/create-supply-stock-entry.dto.js';
import { FindSupplyStockEntriesDto } from './dto/find-supply-stock-entries.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiSecurity,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Role } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Supply Stock Entries')
@ApiBearerAuth()
@Controller('supply-stock-entries')
export class SupplyStockEntriesController {
  constructor(private readonly service: SupplyStockEntriesService) {}

  /**
   * POST /supply-stock-entries
   * Registra un lote físico para un SupplyStock (usado internamente al completar una compra).
   * También expuesto para corrección manual.
   */
  @Post()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un lote físico de insumo en stock (Owner / Admin)' })
  @ApiCreatedResponse({ description: 'Lote registrado y stock incrementado.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (moderateIp).' })
  create(@Body() dto: CreateSupplyStockEntryDto) {
    return this.service.create(dto);
  }

  /**
   * GET /supply-stock-entries
   * Lista paginada de lotes (uso interno / UI de administración).
   */
  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Listar lotes físicos de insumos (paginado)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (moderateIp).' })
  findAll(@Query() query: FindSupplyStockEntriesDto) {
    return this.service.findAll(query);
  }

  /**
   * GET /supply-stock-entries/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR, Role.COLLABORATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Obtener lote físico por ID' })
  @ApiOkResponse({ description: 'Lote encontrado.' })
  @ApiNotFoundResponse({ description: 'No encontrado.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (moderateIp).' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /**
   * POST /supply-stock-entries/initialize-missing
   * Inicializa un SupplyStockEntry vacío para todos los SupplyStocks
   * de la organización que no tengan ningún entry registrado.
   */
  @Post('initialize-missing')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicializar entries faltantes (migración de datos legacy)',
    description:
      'Crea un SupplyStockEntry vacío (agotado) para cada SupplyStock que aún no tenga ningún entry. ' +
      'Útil para supplies creados antes de activar el módulo de producción.',
  })
  @ApiOkResponse({ description: 'Inicialización completada.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (moderateIp).' })
  initializeMissing() {
    return this.service.initializeMissingEntries();
  }
}
