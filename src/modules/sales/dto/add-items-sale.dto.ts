import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSaleItemDto } from './create-sale.dto.js';

/**
 * Used by PATCH /sales/:id/items
 * Adds more product lines to a PENDING sale (quote/order).
 * Not allowed on COMPLETED or CANCELLED sales.
 */
export class AddItemsSaleDto {
  @ApiProperty({
    type: [CreateSaleItemDto],
    description: 'Additional product lines to add to the pending sale',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];
}
