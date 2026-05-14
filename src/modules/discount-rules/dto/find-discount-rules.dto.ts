import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsEnum, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { DiscountType, DiscountScope, DiscountCategory } from '@prisma/client';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindDiscountRulesDto extends PageOptionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por nombre (búsqueda parcial insensible a mayúsculas)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Filtrar por código de descuento' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ enum: DiscountType })
  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;

  @ApiPropertyOptional({ enum: DiscountScope })
  @IsOptional()
  @IsEnum(DiscountScope)
  scope?: DiscountScope;

  @ApiPropertyOptional({ enum: DiscountCategory })
  @IsOptional()
  @IsEnum(DiscountCategory)
  category?: DiscountCategory;

  @ApiPropertyOptional({ description: 'Filtrar por cliente específico' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
