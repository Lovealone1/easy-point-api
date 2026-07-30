import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service.js';
import { CreateMyOrganizationDto } from './dto/create-my-organization.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

/**
 * Self-service organization creation — any authenticated user without an
 * organization may create their own (FREE tier, 5 base modules + the
 * admin-governance modules). Deliberately not gated by RolesGuard/@Roles:
 * this is the one org-creation path open to non-admin users.
 */
@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations/self-service')
export class OrganizationsSelfServiceController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('module-catalog')
  @ApiOperation({
    summary: 'Get the self-service module catalog',
    description:
      'Returns the admin-governance modules (always active) split from the modules a user may pick their 5 base modules from.',
  })
  @ApiOkResponse({ description: 'Module catalog retrieved successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  getModuleCatalog() {
    return this.organizationsService.getSelfServiceCatalog();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create my own organization',
    description:
      'Creates a FREE-tier organization for the calling user, who must not already belong to one. The user becomes OWNER.',
  })
  @ApiCreatedResponse({ description: 'Organization successfully created.' })
  @ApiConflictResponse({ description: 'The user already belongs to an organization.' })
  @ApiBadRequestResponse({ description: 'Invalid module selection.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateMyOrganizationDto,
  ) {
    return this.organizationsService.createForUser(userId, dto);
  }
}
