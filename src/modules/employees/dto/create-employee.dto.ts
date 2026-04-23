import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmployeeStatus } from '@prisma/client';

export class CreateEmployeeDto {

  @ApiProperty({ description: 'Employee first name' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Employee last name' })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ description: 'Tax identifier (RUT / NIT / RFC)' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiProperty({ description: 'Monthly salary (up to 2 decimal places)', minimum: 0 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salary: number;

  @ApiProperty({ description: 'Hire date in ISO 8601 format (e.g. 2024-01-15)' })
  @IsNotEmpty()
  @IsDateString()
  hireDate: string;

  @ApiProperty({ description: 'Job position or title' })
  @IsNotEmpty()
  @IsString()
  position: string;

  @ApiPropertyOptional({ description: 'Work email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ description: 'UUID of the linked system user (optional)' })
  @IsOptional()
  @IsString()
  userId?: string;
}
