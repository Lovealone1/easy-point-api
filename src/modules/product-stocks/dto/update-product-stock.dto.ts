import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateProductStockDto } from './create-product-stock.dto.js';

// We omit productId because changing the associated product of a stock record doesn't make sense usually.
export class UpdateProductStockDto extends PartialType(OmitType(CreateProductStockDto, ['productId'] as const)) {}
