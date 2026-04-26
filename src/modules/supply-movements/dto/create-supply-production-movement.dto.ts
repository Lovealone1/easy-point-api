import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplyProductionMovementDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  supplyId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  stockId: string;

  @ApiProperty({ description: 'Absolute quantity consumed in production. Must be positive.' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
