import { ApiProperty } from '@nestjs/swagger';
import { UserSubscriptionStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateUserSubscriptionStatusDto {
  @ApiProperty({ enum: UserSubscriptionStatus })
  @IsNotEmpty()
  @IsEnum(UserSubscriptionStatus)
  status: UserSubscriptionStatus;
}
