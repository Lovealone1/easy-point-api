import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateExpenseCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  @ApiPropertyOptional({ description: 'Optional category description' })
  @IsOptional()
  @IsString()
  description?: string;
}
