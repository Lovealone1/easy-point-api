import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplyStockEntryDto {
  @ApiProperty({ description: 'ID del SupplyStock al que pertenece este lote' })
  @IsNotEmpty()
  @IsString()
  supplyStockId: string;

  @ApiPropertyOptional({ description: 'ID de la compra de origen (trazabilidad)' })
  @IsOptional()
  @IsString()
  supplyPurchaseId?: string;

  @ApiProperty({ description: 'Cantidad original del lote (ej: 1.5 para 1.5 kg)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  initialQuantity: number;

  @ApiProperty({ description: 'Costo por unidad de medida al momento de la compra' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitCost: number;
}
