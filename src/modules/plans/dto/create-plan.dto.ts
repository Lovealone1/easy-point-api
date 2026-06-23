import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlanDto {
  @ApiProperty({ description: 'Nombre del plan (ej: Free, Basic, Premium)', uniqueItems: true })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Descripción opcional del plan' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Precio mensual del plan' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyPrice: number;

  @ApiProperty({ description: 'Precio anual del plan' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  yearlyPrice: number;

  @ApiPropertyOptional({ description: 'Código de moneda de 3 caracteres (ej: COP, USD)', default: 'COP' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Indica si el plan está activo y puede ser seleccionado', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Metadatos adicionales en formato JSON' })
  @IsOptional()
  metadata?: any;
}
