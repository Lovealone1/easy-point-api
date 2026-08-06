import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class GetCashFlowCalendarDto {
  @ApiPropertyOptional({ description: 'Mes de referencia en formato YYYY-MM (default: mes actual)' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month debe tener el formato YYYY-MM' })
  month?: string;
}
