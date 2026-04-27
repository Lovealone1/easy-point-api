import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { TransactionCategoryType } from '@prisma/client';

export class CreateTransactionCategoryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TransactionCategoryType })
  @IsNotEmpty()
  @IsEnum(TransactionCategoryType)
  type: TransactionCategoryType;
}
