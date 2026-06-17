import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GlobalRole } from '@prisma/client';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: GlobalRole, example: GlobalRole.ADMIN })
  @IsEnum(GlobalRole)
  @IsNotEmpty()
  globalRole: GlobalRole;
}
