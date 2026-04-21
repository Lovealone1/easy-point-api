import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleSupplyActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}
