import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSupplyDto } from './create-supply.dto.js';

// organizationId no está en CreateSupplyDto (viene del header x-organization-id)
// quantityInStock excluido: solo se envía en el create y se gestiona via PATCH /:id/stock
// pricePerUnit nunca estuvo — calculado internamente por el repositorio
export class UpdateSupplyDto extends PartialType(
  OmitType(CreateSupplyDto, ['quantityInStock'] as const),
) {}
