import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { RequestEmailOtpDto } from './dto/request-email-otp.dto.js';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all users paginated (Admin Global Only)' })
  @ApiOkResponse({ description: 'List of users retrieved successfully.' })
  findAll(@Query() pageOptionsDto: PageOptionsDto) {
    return this.usersService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user by ID (Admin Global Only)' })
  @ApiOkResponse({ description: 'User details retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user profile details (Admin Global Only)' })
  @ApiOkResponse({ description: 'User details updated successfully.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user global role (Admin Global Only)' })
  @ApiOkResponse({ description: 'User global role updated successfully.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateRole(id, dto);
  }

  @Post(':id/email/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP to change global user email (Admin Global Only)' })
  @ApiOkResponse({ description: 'OTP code generated and sent to the new email address.' })
  requestEmailOtp(@Param('id') id: string, @Body() dto: RequestEmailOtpDto) {
    return this.usersService.requestEmailOtp(id, dto);
  }

  @Patch(':id/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and update global user email (Admin Global Only)' })
  @ApiOkResponse({ description: 'User email updated successfully.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  verifyEmailOtp(@Param('id') id: string, @Body() dto: VerifyEmailOtpDto) {
    return this.usersService.verifyEmailOtp(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user account (Admin Global Only)' })
  @ApiOkResponse({ description: 'User deleted successfully.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
