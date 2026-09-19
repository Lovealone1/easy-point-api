import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The console sign-in DTOs carry an email and a code and nothing else.
 *
 * They deliberately do NOT reuse GenerateOtpDto / VerifyOtpDto: those accept an
 * `intent`, a `userInfo` block and an `invitationToken`, and the console must
 * never be a route through which an account is created or an invitation
 * accepted. The intent is fixed to ADMIN_LOGIN by the controller, not chosen
 * by the caller.
 */
export class RequestAdminOtpDto {
  @ApiProperty({
    description: 'Email address of the global administrator',
    example: 'admin@example.com',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}

export class VerifyAdminOtpDto extends RequestAdminOtpDto {
  @ApiProperty({
    description: 'The verification code sent to the email',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  otp: string;
}
