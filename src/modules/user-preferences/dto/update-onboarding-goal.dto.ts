import { ApiProperty } from '@nestjs/swagger';
import { OnboardingGoal } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateOnboardingGoalDto {
  @ApiProperty({ enum: OnboardingGoal, description: 'Objetivo principal del usuario' })
  @IsNotEmpty()
  @IsEnum(OnboardingGoal)
  goal: OnboardingGoal;
}
