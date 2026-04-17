import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindOrganizationUsersDto extends PageOptionsDto {
  @ApiProperty({ description: 'The UUID of the organization' })
  @IsUUID()
  readonly organizationId: string;
}
