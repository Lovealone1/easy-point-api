import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../common/enums/role.enum.js';

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
  @IsString({ message: 'Role must be a string representing the role name' })
  @IsNotEmpty()
  role: string;
}
