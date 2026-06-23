import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindPlansDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: 'Filtrar por nombre del plan (búsqueda parcial)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo/inactivo' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
