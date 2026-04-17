import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteRegistrationDto {
  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(2, { message: 'First name must contain at least 2 characters' })
  firstName: string;

  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(2, { message: 'Last name must contain at least 2 characters' })
  lastName: string;

  @ApiProperty({
    description: 'The email address of the user. Not required when registering via invitation (email is read from the invite token).',
    example: 'user@example.com',
    required: false,
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'The raw invitation token when registering via an invitation link.',
    example: 'a1b2c3d4-e5f6-...',
    required: false,
  })
  @IsString()
  @IsOptional()
  invitationToken?: string;

  @ApiProperty({
    description: 'The phone number of the user',
    example: '+1234567890',
    required: false,
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
