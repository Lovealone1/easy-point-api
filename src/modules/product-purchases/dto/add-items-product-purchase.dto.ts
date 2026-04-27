import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductPurchaseItemDto } from './create-product-purchase.dto.js';

export class AddItemsProductPurchaseDto {
  @ApiProperty({
    type: [CreateProductPurchaseItemDto],
    description: 'Additional product lines to add to the pending purchase',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductPurchaseItemDto)
  items: CreateProductPurchaseItemDto[];
}
