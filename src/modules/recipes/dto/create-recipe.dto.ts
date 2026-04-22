import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecipeContentDto } from './recipe-content.dto.js';

export class CreateRecipeDto {
  // organizationId proviene del header x-organization-id via TenantMiddleware
  // NO debe incluirse en el body

  @ApiProperty({ description: 'Nombre de la receta' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Descripción de la receta' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description:
      'Contenido estructurado de la receta: ingredientes, pasos e información de rendimiento.',
    type: RecipeContentDto,
  })
  @ValidateNested()
  @Type(() => RecipeContentDto)
  content: RecipeContentDto;

  @ApiPropertyOptional({
    description: 'Categoría libre de texto (ej. "Repostería", "Panadería")',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Tiempo estimado de preparación en minutos',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  estimatedTime?: number;

  @ApiPropertyOptional({
    description:
      'UUID del producto al que pertenece esta receta. ' +
      'Si se provee, el producto quedará vinculado automáticamente (Product.recipeId = id de la receta creada).',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;
}
