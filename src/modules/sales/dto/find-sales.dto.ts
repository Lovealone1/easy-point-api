import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { SaleStatus } from '@prisma/client';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindSalesDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: 'Filter by organization ID (Global Admin)' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Filter by client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ enum: SaleStatus, description: 'Filter by sale status' })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}
