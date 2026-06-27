import { Controller, Get, Post, Delete, UseGuards, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserInfoService } from './user-info.service.js';
import { CreatePersonaNaturalBillingDto, CreatePersonaJuridicaBillingDto } from './dto/user-info-billing.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';

@ApiTags('User Info')
@Controller('user-info')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserInfoController {
  constructor(private readonly userInfoService: UserInfoService) {}

  @Get('billing')
  @ApiOperation({ summary: 'Get current user billing configuration profile' })
  @ApiOkResponse({ description: 'Billing profile returned successfully.' })
  getBillingProfile(@CurrentUser('sub') userId: string) {
    return this.userInfoService.getBillingProfile(userId);
  }

  @Post('persona-natural')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Configure Natural Person billing profile' })
  @ApiCreatedResponse({ description: 'Natural Person billing profile successfully created.' })
  createPersonaNatural(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePersonaNaturalBillingDto,
  ) {
    return this.userInfoService.createPersonaNatural(userId, dto);
  }

  @Post('persona-juridica')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Configure Legal Person (Company) billing profile' })
  @ApiCreatedResponse({ description: 'Legal Person billing profile successfully created.' })
  createPersonaJuridica(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePersonaJuridicaBillingDto,
  ) {
    return this.userInfoService.createPersonaJuridica(userId, dto);
  }

  @Delete('billing')
  @ApiOperation({ summary: 'Delete active billing profile configuration' })
  @ApiOkResponse({ description: 'Billing profile successfully deleted.' })
  deleteBillingProfile(@CurrentUser('sub') userId: string) {
    return this.userInfoService.deleteBillingProfile(userId);
  }
}
