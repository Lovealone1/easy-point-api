import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubscriptionCategoryDto {
  @ApiProperty({ description: 'Identificador único en kebab-case (ej: entertainment, ai)' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'key debe estar en kebab-case' })
  key: string;

  @ApiProperty({ description: 'Nombre visible de la categoría' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Nombre del ícono (catálogo de íconos del frontend)' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Color hex representativo de la categoría' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color debe ser un hex válido, ej: #6366F1' })
  color?: string;

  @ApiPropertyOptional({ description: 'Orden de aparición', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Si la categoría está activa', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
