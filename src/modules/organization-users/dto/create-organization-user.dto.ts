import { IsUUID, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateOrganizationUserDto {
  @ApiProperty({ description: 'The ID of the user to assign', format: 'uuid' })
  @IsUUID(4)
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'The ID of the organization', format: 'uuid' })
  @IsUUID(4)
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ enum: Role, required: false, default: 'USER', description: 'The role of the user within the organization' })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
