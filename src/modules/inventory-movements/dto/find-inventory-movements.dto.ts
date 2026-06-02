import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { MovementType } from '@prisma/client';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindInventoryMovementsDto extends PageOptionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stockId?: string;

  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  saleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productPurchaseId?: string;
}
