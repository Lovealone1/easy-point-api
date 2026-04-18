import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { FindClientsDto } from './dto/find-clients.dto.js';
import { ToggleClientActiveDto } from './dto/toggle-client-active.dto.js';
import { AddClientNoteDto } from './dto/add-client-note.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiTooManyRequestsResponse, ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role, GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new client (Org Owner / Org Admin)' })
  @ApiCreatedResponse({ description: 'Client successfully created.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List clients paginated (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'List of clients paginated.', type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  findAll(@Query() findOptionsDto: FindClientsDto) {
    return this.clientsService.findAll(findOptionsDto);
  }

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'List all clients globally (Global Admin)' })
  @ApiOkResponse({ description: 'List of all clients across system.', type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindClientsDto) {
    return this.clientsService.findAll(findOptionsDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get a client by ID (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Client details.' })
  @ApiNotFoundResponse({ description: 'Client not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Update a client (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Client updated successfully.' })
  @ApiNotFoundResponse({ description: 'Client not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Toggle client active status (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Client status updated successfully.' })
  @ApiNotFoundResponse({ description: 'Client not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  toggleActive(@Param('id') id: string, @Body() toggleDto: ToggleClientActiveDto) {
    return this.clientsService.toggleActive(id, toggleDto.isActive);
  }

  @Post(':id/notes')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Append a note to client (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Note appended successfully.' })
  @ApiNotFoundResponse({ description: 'Client not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  addNote(@Param('id') id: string, @Body() noteDto: AddClientNoteDto) {
    return this.clientsService.addNote(id, noteDto.notes);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete a client (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Client deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Client not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
