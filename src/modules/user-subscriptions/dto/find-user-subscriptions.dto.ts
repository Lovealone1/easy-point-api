import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, UserSubscriptionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;
}
