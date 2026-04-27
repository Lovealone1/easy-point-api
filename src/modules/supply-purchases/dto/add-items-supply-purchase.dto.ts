import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSupplyPurchaseItemDto } from './create-supply-purchase.dto.js';

/**
 * Used by PATCH /supply-purchases/:id/items
 * Adds more supply lines to a PENDING purchase. Not allowed on COMPLETED purchases.
 */
export class AddItemsSupplyPurchaseDto {
  @ApiProperty({
    type: [CreateSupplyPurchaseItemDto],
    description: 'Additional supply lines to add to the pending purchase',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSupplyPurchaseItemDto)
  items: CreateSupplyPurchaseItemDto[];
}
