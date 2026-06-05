import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindOrganizationUsersDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: 'The UUID of the organization' })
  @IsOptional()
  @IsUUID()
  readonly organizationId?: string;
}

