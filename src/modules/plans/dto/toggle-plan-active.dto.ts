import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class TogglePlanActiveDto {
  @ApiProperty({ description: 'Indica si el plan debe estar activo o inactivo' })
  @IsBoolean()
  isActive: boolean;
}
