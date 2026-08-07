import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceUnit } from '@prisma/client';
import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Length, Max, Min, ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateUserSubscriptionDto {
  @ApiPropertyOptional({ description: 'ID del proveedor del catálogo global (excluyente con customName/customCategoryId)' })
  @ValidateIf((o) => !o.customName)
  @IsNotEmpty()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional({ description: 'Nombre de la suscripción personalizada, cuando no está en el catálogo' })
  @ValidateIf((o) => !o.providerId)
  @IsNotEmpty()
  @IsString()
  customName?: string;

  @ApiPropertyOptional({
    description: 'URL de logo personalizada. Para subir un archivo usa POST /me/subscriptions/:id/logo.',
  })
  @IsOptional()
  @IsUrl()
  customLogoUrl?: string;

  @ApiPropertyOptional({
    description: 'Sitio web del servicio. Solo para suscripciones personalizadas; las del catálogo lo heredan del proveedor.',
  })
  @IsOptional()
  @IsUrl()
  customWebsiteUrl?: string;

  @ApiPropertyOptional({ description: 'Categoría, requerida cuando la suscripción es custom (customName presente)' })
  @ValidateIf((o) => !o.providerId)
  @IsNotEmpty()
  @IsString()
  customCategoryId?: string;

  @ApiPropertyOptional({ description: 'ID de la tarjeta con la que se cobra' })
  @IsOptional()
  @IsString()
  cardId?: string;

  @ApiPropertyOptional({
    description: 'Día de corte propio (1-31). Si se omite se hereda del statementDay de la tarjeta.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  billingCutoffDay?: number;

  @ApiPropertyOptional({ description: 'Nombre del plan/tier contratado (ej: Premium, Familiar)' })
  @IsOptional()
  @IsString()
  planLabel?: string;

  @ApiProperty({ description: 'Monto cobrado por ciclo' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Código ISO 4217 de la moneda en la que se paga', default: 'COP' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  currency?: string;

  @ApiProperty({ enum: RecurrenceUnit, description: 'Unidad de recurrencia del cobro' })
  @IsNotEmpty()
  @IsEnum(RecurrenceUnit)
  recurrenceUnit: RecurrenceUnit;

  @ApiPropertyOptional({
    description: 'Cada cuántas unidades se renueva. "Cada 2 meses" es recurrenceUnit MONTH con recurrenceInterval 2.',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  recurrenceInterval?: number;

  @ApiPropertyOptional({ description: 'false para un cobro único, sin renovación', default: true })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiProperty({ description: 'Fecha en la que inició la suscripción (ISO 8601)' })
  @IsNotEmpty()
  @IsDateString()
  startedAt: string;

  @ApiPropertyOptional({
    description: 'Próxima fecha de cobro (ISO 8601); si se omite se calcula desde startedAt + la recurrencia',
  })
  @IsOptional()
  @IsDateString()
  nextBillingDate?: string;

  @ApiPropertyOptional({ description: 'Si actualmente está en período de prueba', default: false })
  @IsOptional()
  @IsBoolean()
  isTrial?: boolean;

  @ApiPropertyOptional({ description: 'Fecha en la que termina el período de prueba (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;
}
