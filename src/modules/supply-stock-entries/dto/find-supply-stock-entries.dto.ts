import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindSupplyStockEntriesDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: 'Filter by SupplyStock ID' })
  @IsOptional()
  @IsString()
  supplyStockId?: string;

  @ApiPropertyOptional({ description: 'Filter by SupplyPurchase ID' })
  @IsOptional()
  @IsString()
  supplyPurchaseId?: string;

  @ApiPropertyOptional({ description: 'If true, only return non-exhausted entries' })
  @IsOptional()
  isExhausted?: boolean;
}
