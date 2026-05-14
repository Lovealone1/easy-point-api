import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleDiscountRuleActiveDto {
  @ApiProperty({ description: 'Activar o desactivar la regla de descuento' })
  @IsBoolean()
  isActive: boolean;
}
