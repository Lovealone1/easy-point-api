import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleSupplierActiveDto {
  @ApiProperty({ description: 'New active status for the supplier' })
  @IsBoolean()
  isActive: boolean;
}
