import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateOnboardingRegionDto {
  @ApiProperty({ description: 'Zona horaria IANA', example: 'America/Bogota' })
  @IsNotEmpty()
  @IsString()
  timezone: string;

  @ApiProperty({ description: 'Moneda preferida para ver los totales (ISO 4217)', example: 'COP' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  preferredCurrency: string;
}
