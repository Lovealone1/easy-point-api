import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceUnit, UserSubscriptionStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindUserSubscriptionsDto extends PageOptionsDto {
  @ApiPropertyOptional({ enum: UserSubscriptionStatus })
  @IsOptional()
  @IsEnum(UserSubscriptionStatus)
  status?: UserSubscriptionStatus;

  @ApiPropertyOptional({ description: 'Filtrar por ID de tarjeta' })
  @IsOptional()
  @IsString()
  cardId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de categoría (catálogo o custom)' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: RecurrenceUnit, description: 'Filtrar por unidad de recurrencia' })
  @IsOptional()
  @IsEnum(RecurrenceUnit)
  recurrenceUnit?: RecurrenceUnit;

  @ApiPropertyOptional({ description: 'Filtrar recurrentes (true) o cobros únicos (false)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isRecurring?: boolean;
}
