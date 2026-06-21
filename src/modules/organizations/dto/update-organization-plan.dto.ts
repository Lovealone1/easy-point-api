import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrganizationPlanDto {
  @ApiProperty({ required: false, description: 'The new plan for the organization' })
  @IsString()
  @IsOptional()
  plan?: string;

  @ApiProperty({ required: false, description: 'The date until the plan is active (ISOString)' })
  @IsDateString()
  @IsOptional()
  planActiveUntil?: string;
}
