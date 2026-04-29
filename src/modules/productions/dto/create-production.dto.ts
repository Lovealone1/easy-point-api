import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  ValidateNested,
  ArrayMinSize,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductionType, UnitOfMeasure } from '@prisma/client';

export class ProductionSupplyUsageInputDto {
  @ApiProperty({ description: 'ID del Supply a consumir' })
  @IsNotEmpty()
  @IsString()
  supplyId: string;

  @ApiProperty({ description: 'Cantidad a consumir (en la unidad del supply)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantityUsed: number;
}

export class CreateProductionDto {
  @ApiProperty({ description: 'Nombre descriptivo del lote de producción' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Fecha de producción (ISO 8601)', example: '2026-04-29T10:00:00Z' })
  @IsDateString()
  productionDate: string;

  @ApiProperty({ enum: ProductionType, description: 'SELLABLE = produce producto; INTERMEDIATE = insumo interno' })
  @IsEnum(ProductionType)
  type: ProductionType;

  @ApiPropertyOptional({
    description: 'ID del Product resultante. Obligatorio si type = SELLABLE',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ description: 'Cantidad producida' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantityProduced: number;

  @ApiProperty({ enum: UnitOfMeasure, description: 'Unidad de medida del producto producido' })
  @IsEnum(UnitOfMeasure)
  unitOfMeasure: UnitOfMeasure;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [ProductionSupplyUsageInputDto],
    description: 'Insumos a consumir en esta producción',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductionSupplyUsageInputDto)
  supplies: ProductionSupplyUsageInputDto[];
}
