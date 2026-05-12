import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
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
  ApiConflictResponse,
} from '@nestjs/swagger';
import { RolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { getTenantId } from '../../common/context/tenant.context.js';

@ApiTags('Roles')
@ApiSecurity('x-organization-id')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgRolesGuard)
@OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  private getOrgIdOrThrow(): string {
    const orgId = getTenantId();
    if (!orgId) {
      throw new BadRequestException('Organization context is missing');
    }
    return orgId;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new custom role for the organization' })
  @ApiCreatedResponse({ description: 'Role created successfully' })
  @ApiConflictResponse({ description: 'Role name already exists' })
  async create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(this.getOrgIdOrThrow(), createRoleDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all roles (including system defaults) for the organization' })
  @ApiOkResponse({ description: 'List of roles' })
  async findAll(@Query() pageOptionsDto: PageOptionsDto) {
    return this.rolesService.findAll(this.getOrgIdOrThrow(), pageOptionsDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific role by ID' })
  @ApiOkResponse({ description: 'Role found' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  async findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id, this.getOrgIdOrThrow());
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a custom role' })
  @ApiOkResponse({ description: 'Role updated successfully' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiBadRequestResponse({ description: 'Cannot modify system default roles' })
  @ApiConflictResponse({ description: 'Role name already exists' })
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, this.getOrgIdOrThrow(), updateRoleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a custom role' })
  @ApiOkResponse({ description: 'Role deleted successfully' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiBadRequestResponse({ description: 'Cannot delete system default roles' })
  async remove(@Param('id') id: string) {
    return this.rolesService.remove(id, this.getOrgIdOrThrow());
  }
}
