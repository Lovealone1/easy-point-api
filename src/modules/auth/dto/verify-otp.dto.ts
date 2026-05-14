import { IsEmail, IsEnum, IsNotEmpty, IsString, IsOptional, ValidateNested, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AuthIntent } from '../enums/auth-intent.enum.js';

export class UserInfoDto {
  @ApiProperty({ description: 'The first name of the user', example: 'John' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(2, { message: 'First name must contain at least 2 characters' })
  firstName: string;

  @ApiProperty({ description: 'The last name of the user', example: 'Doe' })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(2, { message: 'Last name must contain at least 2 characters' })
  lastName: string;

  @ApiProperty({ description: 'The phone number of the user', example: '+1234567890', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'The email address of the user',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'The intent of the OTP (LOGIN or REGISTER)',
    enum: AuthIntent,
    example: AuthIntent.LOGIN,
  })
  @IsEnum(AuthIntent, { message: 'Intent must be LOGIN or REGISTER' })
  @IsNotEmpty({ message: 'Intent is required' })
  intent: AuthIntent;

  @ApiProperty({
    description: 'The verification code sent to the email',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  otp: string;

  @ApiProperty({
    description: 'User profile information, required when intent is REGISTER',
    type: UserInfoDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserInfoDto)
  userInfo?: UserInfoDto;

  @ApiProperty({
    description: 'The raw invitation token if the user is accepting an invitation during registration',
    example: 'a1b2c3d4-e5f6-...',
    required: false,
  })
  @IsString()
  @IsOptional()
  invitationToken?: string;
}
