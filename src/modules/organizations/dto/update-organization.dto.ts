import { PartialType } from '@nestjs/swagger';
import { CreateOrganizationDto } from './create-organization.dto.js';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {
  @ApiProperty({ description: 'Indicates if the organization is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
