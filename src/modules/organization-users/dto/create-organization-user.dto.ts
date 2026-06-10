import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../common/enums/role.enum.js';

export class CreateOrganizationUserDto {
  @ApiProperty({ description: 'The ID of the user to assign', format: 'uuid' })
  @IsUUID(4)
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: Role, required: false, default: 'USER', description: 'The role of the user within the organization' })
  @IsString()
  @IsOptional()
  role?: string;
}

