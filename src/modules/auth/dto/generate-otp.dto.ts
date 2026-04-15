import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthIntent } from '../enums/auth-intent.enum.js';

export class GenerateOtpDto {
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
}
