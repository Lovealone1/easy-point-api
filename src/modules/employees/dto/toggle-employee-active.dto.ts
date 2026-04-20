import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleEmployeeActiveDto {
  @ApiProperty({ description: 'New active status for the employee' })
  @IsBoolean()
  isActive: boolean;
}
