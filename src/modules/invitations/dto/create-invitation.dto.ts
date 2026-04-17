import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateInvitationDto {
  @ApiProperty({
    description: 'Email address of the person being invited',
    example: 'collaborator@example.com',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Role assigned to the invited user within the organization',
    enum: Role,
    example: Role.COLLABORATOR,
  })
  @IsEnum(Role, { message: 'Role must be a valid organization role' })
  @IsNotEmpty()
  role: Role;
}
