import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleProductCategoryActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}
