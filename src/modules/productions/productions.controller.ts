import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { ProductionsService } from './productions.service.js';
import { CreateProductionDto } from './dto/create-production.dto.js';
import { FindProductionsDto } from './dto/find-productions.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiSecurity,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Productions')
@ApiBearerAuth()
@Controller('productions')
export class ProductionsController {
  constructor(private readonly productionsService: ProductionsService) {}

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'List all productions globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (moderateIp).' })
  findAllGlobal(@Query() query: FindProductionsDto) {
    return this.productionsService.findAll(query);
  }

  /**
   * POST /productions
   * Crea y completa una producción atómicamente:
   * - Consume insumos (FIFO sobre SupplyStockEntry)
   * - Si SELLABLE: incrementa ProductStock y crea InventoryMovement
   * - Registra SupplyMovements y ProductionSupplyUsage
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('productions:create')
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear y completar una producción (Owner / Admin / Collaborator)',
    description:
      'Registra un lote de producción y ejecuta de forma atómica el consumo de insumos ' +
      '(FIFO sobre SupplyStockEntry), el descuento de stock de supplies, y si es SELLABLE ' +
      'el incremento de stock del producto resultante. Requiere rol OWNER, ADMINISTRATOR o COLLABORATOR.',
  })
  @ApiCreatedResponse({ description: 'Producción completada.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos o stock insuficiente.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (moderateIp).' })
  create(
    @Body() dto: CreateProductionDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.productionsService.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('productions:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Listar producciones paginadas (Owner / Admin / Collaborator)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (moderateIp).' })
  findAll(@Query() query: FindProductionsDto) {
    return this.productionsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('productions:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Obtener producción por ID (Owner / Admin / Collaborator)' })
  @ApiOkResponse({ description: 'Producción encontrada.' })
  @ApiNotFoundResponse({ description: 'No encontrada.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (moderateIp).' })
  findOne(@Param('id') id: string) {
    return this.productionsService.findOne(id);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('productions:cancel')
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una producción en estado DRAFT (Owner / Admin)' })
  @ApiOkResponse({ description: 'Producción cancelada.' })
  @ApiBadRequestResponse({ description: 'No se puede cancelar (ya completada o cancelada).' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (moderateIp).' })
  cancel(@Param('id') id: string) {
    return this.productionsService.cancel(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('productions:delete')
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Eliminar una producción (Owner / Admin)',
    description:
      'Elimina una producción de forma permanente. Si la producción está en estado COMPLETADA, ' +
      'se revertirán los movimientos de stock: se restablecerán los insumos consumidos y se descontará ' +
      'el stock del producto resultante.',
  })
  @ApiOkResponse({ description: 'Producción eliminada y stocks revertidos.' })
  @ApiNotFoundResponse({ description: 'No encontrada.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (moderateIp).' })
  remove(@Param('id') id: string) {
    return this.productionsService.remove(id);
  }
}
