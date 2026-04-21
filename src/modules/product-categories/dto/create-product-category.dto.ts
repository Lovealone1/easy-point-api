import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductCategoryDto {

  @ApiProperty({ description: 'Category name (auto-capitalized)' })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().replace(/\b\w/g, (c) => c.toUpperCase())
      : value,
  )
  name: string;

  @ApiProperty({
    description: '3-letter alphanumeric category code — always stored as UPPERCASE (e.g. bev → BEV)',
    minLength: 3,
    maxLength: 3,
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'code must be alphanumeric' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code: string;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
