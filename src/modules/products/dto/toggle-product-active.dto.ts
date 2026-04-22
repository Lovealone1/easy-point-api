import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleProductActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}
