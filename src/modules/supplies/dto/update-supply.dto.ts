import { PartialType } from '@nestjs/swagger';
import { CreateSupplyDto } from './create-supply.dto.js';

// organizationId no está en CreateSupplyDto (viene del header x-organization-id)
// pricePerUnit nunca estuvo — calculado internamente por el repositorio
export class UpdateSupplyDto extends PartialType(CreateSupplyDto) {}
