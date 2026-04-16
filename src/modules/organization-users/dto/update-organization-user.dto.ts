import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UpdateOrganizationUserDto {
  @ApiProperty({ enum: Role, description: 'The new role of the user within the organization' })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;
}
