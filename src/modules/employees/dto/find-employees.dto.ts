import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { EmployeeStatus } from '@prisma/client';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindEmployeesDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: 'Filter by organization UUID' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Filter by first or last name (partial match)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter by job position (partial match)' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus, description: 'Filter by employment status' })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
