import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';
import { BankAccountStatus } from '@prisma/client';

export class FindBankAccountsDto extends PageOptionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: BankAccountStatus })
  @IsOptional()
  @IsEnum(BankAccountStatus)
  status?: BankAccountStatus;
}
