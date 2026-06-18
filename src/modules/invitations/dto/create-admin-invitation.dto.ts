import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateInvitationDto } from './create-invitation.dto.js';

export class CreateAdminInvitationDto extends CreateInvitationDto {
  @ApiProperty({
    description: 'Organization ID where the user is invited',
    example: 'uuid-here',
  })
  @IsString({ message: 'organizationId must be a string representing the organization UUID' })
  @IsNotEmpty()
  organizationId: string;
}
