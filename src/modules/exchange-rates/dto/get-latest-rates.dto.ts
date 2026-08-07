import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetLatestRatesDto {
  @ApiPropertyOptional({
    description: 'Moneda base de la tabla (ISO 4217). Por defecto, la base configurada del proveedor.',
    example: 'COP',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  base?: string;
}
