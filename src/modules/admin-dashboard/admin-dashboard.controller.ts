import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { FindAdminDashboardDto } from './dto/find-admin-dashboard.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@Controller('admin-dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get global admin dashboard statistics with granularity filters (Admin Only)' })
  @ApiOkResponse({ description: 'Aggregated dashboard statistics returned successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  getStats(@Query() query: FindAdminDashboardDto) {
    return this.adminDashboardService.getStats(query);
  }
}
