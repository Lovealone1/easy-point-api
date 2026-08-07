import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteUserSubscriptionCategoryDto {
  @ApiPropertyOptional({
    description:
      'Categoría a la que mover las suscripciones que usan esta. Sin este parámetro, borrar una categoría en uso devuelve 409.',
  })
  @IsOptional()
  @IsString()
  reassignTo?: string;
}
