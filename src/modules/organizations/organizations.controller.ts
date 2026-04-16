import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { UpdateOrganizationPlanDto } from './dto/update-organization-plan.dto.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiTooManyRequestsResponse, ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new organization (Admin Only)' })
  @ApiCreatedResponse({ description: 'Organization successfully created.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationsService.create(createOrganizationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organizations (Admin Only)' })
  @ApiOkResponse({ description: 'List of all organizations paginated.', type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  findAll(@Query() pageOptionsDto: PageOptionsDto) {
    return this.organizationsService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID (Admin Only)' })
  @ApiOkResponse({ description: 'Organization retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Organization not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization (Admin Only)' })
  @ApiOkResponse({ description: 'Organization successfully updated.' })
  @ApiNotFoundResponse({ description: 'Organization not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  update(
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, updateOrganizationDto);
  }

  @Patch(':id/plan')
  @ApiOperation({ summary: 'Update organization plan and active date (Admin Only)' })
  @ApiOkResponse({ description: 'Organization plan successfully updated.' })
  @ApiNotFoundResponse({ description: 'Organization not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  updatePlan(
    @Param('id') id: string,
    @Body() updatePlanDto: UpdateOrganizationPlanDto,
  ) {
    return this.organizationsService.updatePlan(id, updatePlanDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an organization (Admin Only)' })
  @ApiOkResponse({ description: 'Organization successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Organization not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  remove(@Param('id') id: string) {
    return this.organizationsService.remove(id);
  }
}
