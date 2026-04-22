import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto.js';

// sku excluido del update: no se permite cambiar el SKU una vez generado.
// Para sobrescribirlo usar un endpoint dedicado si se requiere en el futuro.
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['sku'] as const),
) {}
