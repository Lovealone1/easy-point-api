import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateStockDto {
  @ApiProperty({
    description:
      'Cantidad absoluta a establecer en stock. Solo este endpoint puede modificar el stock.',
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  quantityInStock: number;
}
