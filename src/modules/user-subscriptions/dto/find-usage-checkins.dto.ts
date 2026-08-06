import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class FindUsageCheckinsDto {
  @ApiPropertyOptional({ description: 'Fecha inicial (YYYY-MM-DD), por defecto 30 días atrás' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Fecha final (YYYY-MM-DD), por defecto hoy' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
