import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestEmailOtpDto {
  @ApiProperty({ example: 'new-email@easypoint.app' })
  @IsEmail()
  @IsNotEmpty()
  newEmail: string;
}
