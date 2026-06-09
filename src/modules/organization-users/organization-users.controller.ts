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
import { OrganizationUsersService } from './organization-users.service.js';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto.js';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto.js';
import { FindOrganizationUsersDto } from './dto/find-organization-users.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiTooManyRequestsResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Organization Users')
@ApiBearerAuth()
@ApiSecurity('x-organization-id')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('organization-users')
export class OrganizationUsersController {
  constructor(private readonly organizationUsersService: OrganizationUsersService) {}

  @Post()
  @RequirePermission('organization_users:change_role')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a user to an organization (Admin / Org Owner / Org Admin)' })
  @ApiCreatedResponse({ description: 'User successfully assigned to organization.' })
  @ApiConflictResponse({ description: 'User is already in the organization or an OWNER already exists.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  create(@Body() createOrganizationUserDto: CreateOrganizationUserDto) {
    return this.organizationUsersService.create(createOrganizationUserDto);
  }

  @Get()
  @RequirePermission('organization_users:read')
  @ApiOperation({ summary: 'List all members of an organization paginated (Admin / Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'List of all users in the organization paginated.', type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  findAll(
    @Query() findOptionsDto: FindOrganizationUsersDto
  ) {
    return this.organizationUsersService.findAll(findOptionsDto);
  }

  @Patch(':id')
  @RequirePermission('organization_users:change_role')
  @ApiOperation({ summary: 'Modify the role of an organization user (Admin / Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Role successfully modified.' })
  @ApiConflictResponse({ description: 'An OWNER already exists.' })
  @ApiNotFoundResponse({ description: 'Association not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  update(
    @Param('id') id: string,
    @Body() updateOrganizationUserDto: UpdateOrganizationUserDto,
    @CurrentUser('sub') actorUserId: string,
  ) {
    return this.organizationUsersService.update(id, updateOrganizationUserDto, actorUserId);
  }

  @Delete(':id')
  @RequirePermission('organization_users:remove')
  @ApiOperation({ summary: 'Remove a user from an organization (Admin / Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'User successfully removed from the organization.' })
  @ApiNotFoundResponse({ description: 'Association not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  remove(
    @Param('id') id: string,
    @CurrentUser('sub') actorUserId: string,
  ) {
    return this.organizationUsersService.remove(id, actorUserId);
  }
}
