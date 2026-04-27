import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BankAccountStatus } from '@prisma/client';

export class ChangeBankAccountStatusDto {
  @ApiProperty({ enum: BankAccountStatus })
  @IsEnum(BankAccountStatus)
  status: BankAccountStatus;
}
