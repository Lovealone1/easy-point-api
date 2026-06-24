import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { BillingCycle, SubscriptionStatus } from '@prisma/client';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ description: 'ID del plan' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ enum: BillingCycle, description: 'Ciclo de facturación' })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({ enum: SubscriptionStatus, description: 'Estado de la suscripción' })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'Fecha de inicio del período actual' })
  @IsOptional()
  @IsDateString()
  currentPeriodStart?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin del período actual' })
  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;

  @ApiPropertyOptional({ description: 'Fecha en la que termina la prueba' })
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @ApiPropertyOptional({ description: 'Notas opcionales' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Metadatos adicionales en formato JSON' })
  @IsOptional()
  metadata?: any;
}
