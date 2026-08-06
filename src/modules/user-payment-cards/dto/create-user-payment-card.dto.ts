import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardBrand } from '@prisma/client';
import {
  IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches, Max, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserPaymentCardDto {
  @ApiProperty({ description: 'Nombre elegido por el usuario para identificar la tarjeta (ej: Bancolombia, Nubank)' })
  @IsNotEmpty()
  @IsString()
  label: string;

  @ApiProperty({ enum: CardBrand, description: 'Marca/franquicia de la tarjeta' })
  @IsNotEmpty()
  @IsEnum(CardBrand)
  brand: CardBrand;

  @ApiPropertyOptional({ description: 'Color hex para representar visualmente la tarjeta', default: '#6366F1' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color debe ser un hex válido, ej: #6366F1' })
  color?: string;

  @ApiPropertyOptional({ description: 'Últimos 4 dígitos de la tarjeta (opcional, nunca el número completo)' })
  @IsOptional()
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'lastFourDigits debe contener exactamente 4 dígitos' })
  lastFourDigits?: string;

  @ApiPropertyOptional({ description: 'Día del mes de la fecha de corte (1-31)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  statementDay?: number;

  @ApiPropertyOptional({ description: 'Día del mes de la fecha límite de pago (1-31)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDueDay?: number;

  @ApiPropertyOptional({ description: 'Marcar como tarjeta predeterminada', default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;
}
