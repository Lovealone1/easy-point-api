import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SuppliesService } from './supplies.service.js';
import { CreateSupplyDto } from './dto/create-supply.dto.js';
import { UpdateSupplyDto } from './dto/update-supply.dto.js';
import { FindSuppliesDto } from './dto/find-supplies.dto.js';
import { ToggleSupplyActiveDto } from './dto/toggle-supply-active.dto.js';
import { AddSupplyNoteDto } from './dto/add-supply-note.dto.js';
import { UpdateStockDto } from './dto/update-supply-stock.dto.js';
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
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role, GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Supplies')
@ApiBearerAuth()
@Controller('supplies')
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  // --- RUTA GLOBAL ADMIN (declarada antes de :id) ---

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all supplies globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindSuppliesDto) {
    return this.suppliesService.findAll(findOptionsDto);
  }

  // --- RUTAS DE ORGANIZACIÓN ---

  @Post()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a supply (Org Owner / Org Admin)' })
  @ApiCreatedResponse({ description: 'Supply created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(@Body() createSupplyDto: CreateSupplyDto) {
    return this.suppliesService.create(createSupplyDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List supplies paginated (Org Owner / Org Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() findOptionsDto: FindSuppliesDto) {
    return this.suppliesService.findAll(findOptionsDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get supply by ID (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Supply found.' })
  @ApiNotFoundResponse({ description: 'Supply not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.suppliesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Update supply (Org Owner / Org Admin)',
    description:
      'Actualiza campos del supply. pricePerUnit se recalcula automáticamente si cambia basePrice o packageSize. quantityInStock NO se puede modificar desde este endpoint.',
  })
  @ApiOkResponse({ description: 'Supply updated successfully.' })
  @ApiNotFoundResponse({ description: 'Supply not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(@Param('id') id: string, @Body() updateSupplyDto: UpdateSupplyDto) {
    return this.suppliesService.update(id, updateSupplyDto);
  }

  @Patch(':id/stock')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Update stock quantity (Org Owner / Org Admin)',
    description:
      'Único endpoint autorizado para modificar quantityInStock. Establece la cantidad absoluta en inventario.',
  })
  @ApiOkResponse({ description: 'Stock updated successfully.' })
  @ApiNotFoundResponse({ description: 'Supply not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  updateStock(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    return this.suppliesService.updateStock(id, updateStockDto.quantityInStock);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Toggle active status (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Status updated.' })
  @ApiNotFoundResponse({ description: 'Supply not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  toggleActive(@Param('id') id: string, @Body() toggleDto: ToggleSupplyActiveDto) {
    return this.suppliesService.toggleActive(id, toggleDto.isActive);
  }

  @Post(':id/notes')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add note (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Note appended.' })
  @ApiNotFoundResponse({ description: 'Supply not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  addNote(@Param('id') id: string, @Body() noteDto: AddSupplyNoteDto) {
    return this.suppliesService.addNote(id, noteDto.notes);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete supply (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Supply deleted.' })
  @ApiNotFoundResponse({ description: 'Supply not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.suppliesService.remove(id);
  }
}
