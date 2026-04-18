import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleClientActiveDto {
  @ApiProperty({ description: 'The new active status for the client' })
  @IsBoolean()
  isActive: boolean;
}
