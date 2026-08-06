import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from '@prisma/client';
import {
  IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Min, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @ApiPropertyOptional({ description: 'URL de logo personalizada para una suscripción custom' })
  @IsOptional()
  @IsUrl()
  customLogoUrl?: string;

  @ApiPropertyOptional({ description: 'Categoría, requerida cuando la suscripción es custom (customName presente)' })
  @ValidateIf((o) => !o.providerId)
  @IsNotEmpty()
  @IsString()
  customCategoryId?: string;

  @ApiPropertyOptional({ description: 'ID de la tarjeta con la que se cobra' })
  @IsOptional()
  @IsString()
  cardId?: string;

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

  @ApiPropertyOptional({ description: 'Código de moneda de 3 caracteres', default: 'COP' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: BillingCycle, description: 'Frecuencia de cobro' })
  @IsNotEmpty()
  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @ApiProperty({ description: 'Fecha en la que inició la suscripción (ISO 8601)' })
  @IsNotEmpty()
  @IsDateString()
  startedAt: string;

  @ApiPropertyOptional({ description: 'Próxima fecha de cobro (ISO 8601); si se omite se calcula desde startedAt + billingCycle' })
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
