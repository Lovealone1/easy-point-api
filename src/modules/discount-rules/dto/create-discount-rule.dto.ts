import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType, DiscountScope, DiscountCategory } from '@prisma/client';

export class CreateDiscountRuleDto {
  // organizationId proviene del header x-organization-id via TenantMiddleware

  @ApiProperty({ description: 'Nombre descriptivo del descuento. Ej: "Promoción Verano 25%"' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Descripción extendida del descuento' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Código corto para aplicar el descuento (ej: "PROM25"). ' +
      'Si no se provee, se genera automáticamente a partir del nombre.',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    enum: DiscountType,
    description: 'FIXED_AMOUNT = monto fijo; PERCENTAGE = porcentaje sobre el subtotal',
  })
  @IsEnum(DiscountType)
  type: DiscountType;

  @ApiProperty({
    description:
      'Valor del descuento. Para PERCENTAGE: entre 0 y 100. Para FIXED_AMOUNT: monto en moneda local.',
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Type(() => Number)
  @Min(0)
  @Max(100, {
    message: 'Para PERCENTAGE el valor máximo es 100. Para FIXED_AMOUNT use un monto positivo.',
  })
  value: number;

  @ApiProperty({
    enum: DiscountScope,
    description: 'GLOBAL = cualquier cliente; CLIENT = cliente específico',
  })
  @IsEnum(DiscountScope)
  scope: DiscountScope;

  @ApiPropertyOptional({
    description: 'ID del cliente al que aplica. Obligatorio cuando scope = CLIENT.',
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty({
    enum: DiscountCategory,
    description: 'ONE_TIME = descuento puntual; PERIODIC = descuento con vigencia por fechas',
  })
  @IsEnum(DiscountCategory)
  category: DiscountCategory;

  @ApiPropertyOptional({ description: 'Fecha de inicio de vigencia (ISO 8601). Principalmente para PERIODIC.' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'Fecha de expiración del descuento (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description:
      'Techo de descuento en moneda local. Solo aplica para PERCENTAGE. ' +
      'Ej: 10% pero máximo $5.000.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Type(() => Number)
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({
    description: 'Monto mínimo de la venta (subtotal) para que el descuento sea aplicable.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Type(() => Number)
  @Min(0)
  minSaleAmount?: number;

  @ApiPropertyOptional({
    description: 'Número máximo de veces que se puede usar este descuento. null = ilimitado.',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  maxUsages?: number;

  @ApiPropertyOptional({ description: '¿Está activo? Por defecto true.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Notas internas del descuento.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
