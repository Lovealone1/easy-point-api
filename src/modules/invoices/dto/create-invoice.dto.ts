import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsDateString,
  IsEnum,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'ID de la organización' })
  @IsNotEmpty()
  @IsString()
  organizationId: string;

  @ApiProperty({ description: 'ID de la suscripción' })
  @IsNotEmpty()
  @IsString()
  subscriptionId: string;

  @ApiProperty({ description: 'Monto de la factura' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Código de moneda de 3 caracteres (ej: COP, USD)', default: 'COP' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ enum: InvoiceStatus, description: 'Estado inicial de la factura', default: InvoiceStatus.PENDING })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiProperty({ description: 'Fecha de vencimiento' })
  @IsNotEmpty()
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ description: 'Fecha de pago' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({ description: 'Referencia del pago' })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional({ description: 'Método de pago' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Notas sobre el pago' })
  @IsOptional()
  @IsString()
  paymentNotes?: string;

  @ApiProperty({ description: 'Inicio del período de facturación' })
  @IsNotEmpty()
  @IsDateString()
  billingPeriodStart: string;

  @ApiProperty({ description: 'Fin del período de facturación' })
  @IsNotEmpty()
  @IsDateString()
  billingPeriodEnd: string;

  @ApiPropertyOptional({ description: 'Metadatos adicionales en formato JSON' })
  @IsOptional()
  metadata?: any;

  @ApiPropertyOptional({ description: 'Notas de la factura' })
  @IsOptional()
  @IsString()
  notes?: string;
}
