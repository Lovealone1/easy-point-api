import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UnitOfMeasure } from '@prisma/client';

export class CreateSupplyDto {
  // organizationId proviene del header x-organization-id via TenantMiddleware
  // NO debe incluirse en el body

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: UnitOfMeasure })
  @IsNotEmpty()
  @IsEnum(UnitOfMeasure)
  unitOfMeasure: UnitOfMeasure;

  @ApiProperty({ description: 'Tamaño del empaque (gr, ml, und, etc.)' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  packageSize: number;

  @ApiProperty({ description: 'Precio de compra del empaque completo' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePrice: number;

  // pricePerUnit excluido intencionalmente: calculado automáticamente por el repositorio

  @ApiPropertyOptional({
    description: 'Stock inicial al crear la materia prima. Por defecto 0.',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  quantityInStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
