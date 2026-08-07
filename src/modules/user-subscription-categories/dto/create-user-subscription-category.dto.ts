import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateUserSubscriptionCategoryDto {
  @ApiProperty({ description: 'Nombre visible de la categoría', example: 'Mascotas' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({
    description: 'Nombre del icono (Material Symbols). Si se omite se usa uno genérico.',
    example: 'pets-rounded',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  icon?: string;

  @ApiPropertyOptional({ description: 'Color en hexadecimal de 6 dígitos', example: '#8b1fc1' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color debe ser un hexadecimal de 6 dígitos, por ejemplo #8b1fc1',
  })
  color?: string;

  @ApiPropertyOptional({ description: 'Orden de aparición', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
