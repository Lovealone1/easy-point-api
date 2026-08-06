import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional } from 'class-validator';

export class LogUsageCheckinDto {
  @ApiPropertyOptional({ description: 'Fecha del check-in (YYYY-MM-DD). Por defecto, hoy.' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ description: '¿Se usó la suscripción ese día?' })
  @IsNotEmpty()
  @IsBoolean()
  used: boolean;
}
