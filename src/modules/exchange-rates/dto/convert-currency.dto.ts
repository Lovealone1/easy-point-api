import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Length, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ConvertCurrencyDto {
  @ApiProperty({ description: 'Moneda de origen (ISO 4217)', example: 'USD' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  from: string;

  @ApiProperty({ description: 'Moneda de destino (ISO 4217)', example: 'COP' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  to: string;

  @ApiProperty({ description: 'Monto a convertir', example: 9.99 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;
}
