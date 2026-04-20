import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AssignEmployeeUserDto {
  @ApiPropertyOptional({
    description: 'UUID of the system user to link with this employee. Send null to unlink.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  userId: string | null;
}
