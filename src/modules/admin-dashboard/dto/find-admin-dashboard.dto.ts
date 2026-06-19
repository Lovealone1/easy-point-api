import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum AdminDashboardGranularity {
  TODAY = 'today',
  MONTH = 'month',
  YEAR = 'year',
  RANGE = 'range',
}

export class FindAdminDashboardDto {
  @ApiPropertyOptional({
    enum: AdminDashboardGranularity,
    description: 'Select granularity for the dashboard data',
    default: AdminDashboardGranularity.MONTH,
  })
  @IsOptional()
  @IsEnum(AdminDashboardGranularity)
  granularity?: AdminDashboardGranularity = AdminDashboardGranularity.MONTH;

  @ApiPropertyOptional({ description: 'Start date for custom range (ISO 8601 or YYYY-MM-DD)', example: '2026-06-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for custom range (ISO 8601 or YYYY-MM-DD)', example: '2026-06-30' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Specific month (1-12)', example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ description: 'Specific year (e.g. 2026)', example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
