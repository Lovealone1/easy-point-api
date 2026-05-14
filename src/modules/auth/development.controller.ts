import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { InvitationsService } from '../invitations/invitations.service.js';
import { GenerateOtpDto } from './dto/generate-otp.dto.js';

@Controller('development')
@ApiTags('Development')
export class DevelopmentController {
  constructor(
    private readonly authService: AuthService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Post('otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate OTP (Development)', description: 'Generates an OTP and returns it locally. Only allowed in development environment.' })
  @ApiOkResponse({ description: 'The OTP has been generated successfully and returned.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  async generateDevOtp(@Body() payload: GenerateOtpDto) {
    // isDevMode = true
    return this.authService.generateOtp(payload, true);
  }

  @Get('invitations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Pending Invitations (Development)', description: 'Returns all pending invitations and their tokens. Only allowed in development environment.' })
  @ApiOkResponse({ description: 'List of pending invitations returned successfully.' })
  async getDevInvitations() {
    return this.invitationsService.getDevInvitations();
  }
}
