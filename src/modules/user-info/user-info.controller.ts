import { Controller, Get, Post, Delete, UseGuards, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { UserInfoService } from './user-info.service.js';
import { CreatePersonaNaturalBillingDto, CreatePersonaJuridicaBillingDto } from './dto/user-info-billing.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';

import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';

@ApiTags('User Info')
@Controller('user-info')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@ApiBearerAuth()
export class UserInfoController {
  constructor(private readonly userInfoService: UserInfoService) {}

  @Get(':userId/billing')
  @ApiOperation({ summary: 'Get user billing configuration profile by ID' })
  @ApiOkResponse({ description: 'Billing profile returned successfully.' })
  getBillingProfile(
    @Param('userId') userId: string,
  ) {
    return this.userInfoService.getBillingProfile(userId);
  }

  @Post(':userId/persona-natural')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Configure Natural Person billing profile by User ID' })
  @ApiCreatedResponse({ description: 'Natural Person billing profile successfully created.' })
  createPersonaNatural(
    @Param('userId') userId: string,
    @Body() dto: CreatePersonaNaturalBillingDto,
  ) {
    return this.userInfoService.createPersonaNatural(userId, dto);
  }

  @Post(':userId/persona-juridica')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Configure Legal Person (Company) billing profile by User ID' })
  @ApiCreatedResponse({ description: 'Legal Person billing profile successfully created.' })
  createPersonaJuridica(
    @Param('userId') userId: string,
    @Body() dto: CreatePersonaJuridicaBillingDto,
  ) {
    return this.userInfoService.createPersonaJuridica(userId, dto);
  }

  @Delete(':userId/billing')
  @ApiOperation({ summary: 'Delete active billing profile configuration by User ID' })
  @ApiOkResponse({ description: 'Billing profile successfully deleted.' })
  deleteBillingProfile(
    @Param('userId') userId: string,
  ) {
    return this.userInfoService.deleteBillingProfile(userId);
  }
}
