import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleTransactionCategoryActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}
