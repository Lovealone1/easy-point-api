import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';
import { TransactionCategoryType } from '@prisma/client';

export class FindTransactionCategoriesDto extends PageOptionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: TransactionCategoryType })
  @IsOptional()
  @IsEnum(TransactionCategoryType)
  type?: TransactionCategoryType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
