import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSupplyStockDto } from './create-supply-stock.dto.js';

export class UpdateSupplyStockDto extends PartialType(OmitType(CreateSupplyStockDto, ['supplyId'] as const)) {}
