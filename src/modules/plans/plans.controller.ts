import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PlansService } from './plans.service.js';
import { CreatePlanDto } from './dto/create-plan.dto.js';
import { UpdatePlanDto } from './dto/update-plan.dto.js';
import { FindPlansDto } from './dto/find-plans.dto.js';
import { TogglePlanActiveDto } from './dto/toggle-plan-active.dto.js';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiTooManyRequestsResponse, ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new pricing plan (Admin Only)' })
  @ApiCreatedResponse({ description: 'Plan successfully created.' })
  @ApiBadRequestResponse({ description: 'Invalid payload or duplicate name.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(@Body() createPlanDto: CreatePlanDto) {
    return this.plansService.create(createPlanDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all pricing plans' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() findOptionsDto: FindPlansDto) {
    return this.plansService.findAll(findOptionsDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plan details by ID' })
  @ApiOkResponse({ description: 'Plan found.' })
  @ApiNotFoundResponse({ description: 'Plan not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update plan details (Admin Only)' })
  @ApiOkResponse({ description: 'Plan successfully updated.' })
  @ApiNotFoundResponse({ description: 'Plan not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(@Param('id') id: string, @Body() updatePlanDto: UpdatePlanDto) {
    return this.plansService.update(id, updatePlanDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle active status of a plan (Admin Only)' })
  @ApiOkResponse({ description: 'Plan status updated.' })
  @ApiNotFoundResponse({ description: 'Plan not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  toggleActive(@Param('id') id: string, @Body() toggleDto: TogglePlanActiveDto) {
    return this.plansService.toggleActive(id, toggleDto.isActive);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a plan (Admin Only)' })
  @ApiOkResponse({ description: 'Plan successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Plan not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.plansService.remove(id);
  }
}
