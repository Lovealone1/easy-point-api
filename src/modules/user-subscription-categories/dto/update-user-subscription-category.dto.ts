import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserSubscriptionCategoryDto } from './create-user-subscription-category.dto.js';

export class UpdateUserSubscriptionCategoryDto extends PartialType(CreateUserSubscriptionCategoryDto) {
  @ApiPropertyOptional({ description: 'Ocultar la categoría sin borrarla' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
