import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindUtilitiesDto extends PageOptionsDto {
  /** Solo para rutas global admin */
  @ApiPropertyOptional({ description: 'Filter by organization ID (Global Admin only)' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)', example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)', example: '2026-04-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by product ID' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by product category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by the user who performed the sale' })
  @IsOptional()
  @IsString()
  performedByUserId?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Filter by payment method used in the financial transaction',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
