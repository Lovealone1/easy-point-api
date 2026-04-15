import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { GenerateOtpDto } from './dto/generate-otp.dto.js';

@Controller('development')
@ApiTags('Development')
export class DevelopmentController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate OTP (Development)', description: 'Generates an OTP and returns it locally. Only allowed in development environment.' })
  @ApiOkResponse({ description: 'The OTP has been generated successfully and returned.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit strictly exceeded.' })
  async generateDevOtp(@Body() payload: GenerateOtpDto) {
    // isDevReturn = true
    return this.authService.generateOtp(payload, true);
  }
}
