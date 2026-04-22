import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleRecipeActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}
