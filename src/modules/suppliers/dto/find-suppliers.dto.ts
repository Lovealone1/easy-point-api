import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindSuppliersDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: 'Filter by organization UUID' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Filter by supplier name (partial match)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
