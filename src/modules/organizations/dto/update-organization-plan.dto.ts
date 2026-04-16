import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class UpdateOrganizationPlanDto {
  @ApiProperty({ enum: Plan, required: false, description: 'The new plan for the organization' })
  @IsEnum(Plan)
  @IsOptional()
  plan?: Plan;

  @ApiProperty({ required: false, description: 'The date until the plan is active (ISOString)' })
  @IsDateString()
  @IsOptional()
  planActiveUntil?: string;
}
