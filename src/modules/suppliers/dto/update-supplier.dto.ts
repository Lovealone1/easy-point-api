import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSupplierDto } from './create-supplier.dto.js';

export class UpdateSupplierDto extends PartialType(
  OmitType(CreateSupplierDto, ['organizationId'] as const),
) {}
