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
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { FindEmployeesDto } from './dto/find-employees.dto.js';
import { ToggleEmployeeActiveDto } from './dto/toggle-employee-active.dto.js';
import { AddEmployeeNoteDto } from './dto/add-employee-note.dto.js';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto.js';
import { AssignEmployeeUserDto } from './dto/assign-employee-user.dto.js';
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

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // --- RUTAS DE ORGANIZACIÓN ---

  @Post()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new employee (Org Owner / Org Admin)' })
  @ApiCreatedResponse({ description: 'Employee successfully created.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeesService.create(createEmployeeDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List employees paginated (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'List of employees paginated.', type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  findAll(@Query() findOptionsDto: FindEmployeesDto) {
    return this.employeesService.findAll(findOptionsDto);
  }

  // IMPORTANT: declared BEFORE :id to avoid NestJS treating "global" as a route param
  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'List all employees globally (Global Admin)' })
  @ApiOkResponse({ description: 'List of all employees across the system.', type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindEmployeesDto) {
    return this.employeesService.findAll(findOptionsDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get an employee by ID (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Employee details.' })
  @ApiNotFoundResponse({ description: 'Employee not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Update an employee (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Employee updated successfully.' })
  @ApiNotFoundResponse({ description: 'Employee not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  update(@Param('id') id: string, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeesService.update(id, updateEmployeeDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Toggle employee active status (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Employee active status updated.' })
  @ApiNotFoundResponse({ description: 'Employee not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  toggleActive(@Param('id') id: string, @Body() toggleDto: ToggleEmployeeActiveDto) {
    return this.employeesService.toggleActive(id, toggleDto.isActive);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Update employment status (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Employment status updated.' })
  @ApiNotFoundResponse({ description: 'Employee not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  updateStatus(@Param('id') id: string, @Body() statusDto: UpdateEmployeeStatusDto) {
    return this.employeesService.updateStatus(id, statusDto.status);
  }

  @Patch(':id/assign-user')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Assign or unlink a system user to this employee (Org Owner / Org Admin)',
    description: 'Send `userId` with a valid UUID to link, or `null` to unlink.',
  })
  @ApiOkResponse({ description: 'User assignment updated.' })
  @ApiNotFoundResponse({ description: 'Employee not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  assignUser(@Param('id') id: string, @Body() assignDto: AssignEmployeeUserDto) {
    return this.employeesService.assignUser(id, assignDto.userId);
  }

  @Post(':id/notes')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Append a note to employee (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Note appended successfully.' })
  @ApiNotFoundResponse({ description: 'Employee not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  addNote(@Param('id') id: string, @Body() noteDto: AddEmployeeNoteDto) {
    return this.employeesService.addNote(id, noteDto.notes);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete an employee (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Employee deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Employee not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
