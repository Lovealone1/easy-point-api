import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class UpdateEmployeeStatusDto {
  @ApiProperty({ enum: EmployeeStatus, description: 'New employment status' })
  @IsEnum(EmployeeStatus)
  status: EmployeeStatus;
}
