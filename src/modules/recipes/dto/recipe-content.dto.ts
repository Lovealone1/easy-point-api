import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  Min,
  ValidateNested,
  IsArray,
  IsInt,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecipeIngredientDto {
  @ApiProperty({ description: 'UUID del Supply (materia prima)' })
  @IsNotEmpty()
  @IsUUID()
  supplyId: string;

  @ApiPropertyOptional({
    description:
      'Nombre del ingrediente. Si se omite, se resuelve automáticamente desde el Supply registrado.',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Cantidad del ingrediente', minimum: 0.0001 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity: number;

  @ApiProperty({ description: 'Unidad de medida: gr, ml, und, kg, lt, etc.' })
  @IsNotEmpty()
  @IsString()
  unit: string;
}

export class RecipeStepDto {
  @ApiProperty({ description: 'Número de orden del paso (1-based)', minimum: 1 })
  @IsInt()
  @IsPositive()
  order: number;

  @ApiProperty({ description: 'Instrucción del paso' })
  @IsNotEmpty()
  @IsString()
  instruction: string;
}

export class RecipeMetadataDto {
  @ApiProperty({ description: 'Cantidad de unidades que produce la receta', minimum: 0.0001 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  yieldQuantity: number;

  @ApiProperty({ description: 'Descripción de la unidad, ej. "Bizcocho Grande", "Porciones"' })
  @IsNotEmpty()
  @IsString()
  yieldUnit: string;
}

export class RecipeContentDto {
  @ApiProperty({ type: [RecipeIngredientDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];

  @ApiProperty({ type: [RecipeStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeStepDto)
  steps: RecipeStepDto[];

  @ApiProperty({ type: RecipeMetadataDto })
  @ValidateNested()
  @Type(() => RecipeMetadataDto)
  metadata: RecipeMetadataDto;
}
