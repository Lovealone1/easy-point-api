import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service.js';
import { CreateMyOrganizationDto } from './dto/create-my-organization.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';

/**
 * Self-service organization creation — any authenticated user without an
 * organization may create their own (FREE tier, 7-day full-access trial,
 * every active module). Deliberately not gated by RolesGuard/@Roles: this
 * is the one org-creation path open to non-admin users.
 */
@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AllowWithoutSubscription()
@Controller('organizations/self-service')
export class OrganizationsSelfServiceController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create my own organization',
    description:
      'Creates a FREE-tier organization for the calling user, who must not already belong to one. The user becomes OWNER.',
  })
  @ApiCreatedResponse({ description: 'Organization successfully created.' })
  @ApiConflictResponse({ description: 'The user already belongs to an organization.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateMyOrganizationDto,
  ) {
    return this.organizationsService.createForUser(userId, dto);
  }
}
