import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInvitationDto {
  @ApiProperty({
    description: 'The raw invitation token received from the invitation link',
    example: 'a1b2c3d4-e5f6-...',
  })
  @IsString()
  @IsNotEmpty()
  invitationToken: string;
}
