import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindSupplyStocksDto extends PageOptionsDto {
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
  location?: string;
}
