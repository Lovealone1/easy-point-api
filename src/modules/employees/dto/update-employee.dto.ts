import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto.js';

export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['organizationId'] as const),
) {}
