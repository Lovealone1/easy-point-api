import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleExpenseCategoryActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}
