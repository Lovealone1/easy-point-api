import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateOrganizationUserDto } from './create-organization-user.dto.js';

export class UpdateOrganizationUserDto extends PartialType(
  OmitType(CreateOrganizationUserDto, ['userId'] as const),
) {}

