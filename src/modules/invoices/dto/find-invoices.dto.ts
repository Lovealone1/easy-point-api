import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';
import { InvoiceStatus } from '@prisma/client';

export class FindInvoicesDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: 'Filtrar por ID de organización' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de suscripción' })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional({ enum: InvoiceStatus, description: 'Filtrar por estado de la factura' })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Filtrar por número de factura (búsqueda parcial)' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;
}
