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
  BadRequestException,
} from '@nestjs/common';
import { OrganizationUsersService } from './organization-users.service.js';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto.js';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto.js';
import { FindOrganizationUsersDto } from './dto/find-organization-users.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiTooManyRequestsResponse, ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiConflictResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Role } from '@prisma/client';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Organization Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgRolesGuard)
@OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
@Controller('organization-users')
export class OrganizationUsersController {
  constructor(private readonly organizationUsersService: OrganizationUsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a user to an organization (Admin / Org Owner / Org Admin)' })
  @ApiCreatedResponse({ description: 'User successfully assigned to organization.' })
  @ApiConflictResponse({ description: 'User is already in the organization or an OWNER already exists.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  create(@Body() createOrganizationUserDto: CreateOrganizationUserDto) {
    return this.organizationUsersService.create(createOrganizationUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all members of an organization paginated (Admin / Org Owner / Org Admin)' })
  @ApiQuery({ name: 'organizationId', required: true, description: 'The UUID of the organization', type: String })
  @ApiOkResponse({ description: 'List of all users in the organization paginated.', type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  findAll(
    @Query() findOptionsDto: FindOrganizationUsersDto
  ) {
    if (!findOptionsDto.organizationId) {
       throw new BadRequestException('organizationId is required query parameter');
    }
    return this.organizationUsersService.findAll(findOptionsDto.organizationId, findOptionsDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modify the role of an organization user (Admin / Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Role successfully modified.' })
  @ApiConflictResponse({ description: 'An OWNER already exists.' })
  @ApiNotFoundResponse({ description: 'Association not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  updateRole(
    @Param('id') id: string,
    @Body() updateOrganizationUserDto: UpdateOrganizationUserDto,
  ) {
    return this.organizationUsersService.updateRole(id, updateOrganizationUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a user from an organization (Admin / Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'User successfully removed from the organization.' })
  @ApiNotFoundResponse({ description: 'Association not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  remove(@Param('id') id: string) {
    return this.organizationUsersService.remove(id);
  }
}
