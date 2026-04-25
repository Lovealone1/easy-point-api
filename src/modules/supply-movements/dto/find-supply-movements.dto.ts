import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { SupplyMovementType } from '@prisma/client';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindSupplyMovementsDto extends PageOptionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stockId?: string;

  @ApiPropertyOptional({ enum: SupplyMovementType })
  @IsOptional()
  @IsEnum(SupplyMovementType)
  type?: SupplyMovementType;
}
