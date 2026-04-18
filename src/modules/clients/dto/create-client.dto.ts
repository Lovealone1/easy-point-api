import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail, IsEnum, IsNumber, Min } from 'class-validator';
import { ClientType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateClientDto {
  @ApiProperty({ description: 'The UUID of the organization' })
  @IsNotEmpty()
  @IsString()
  organizationId: string;

  @ApiProperty({ description: 'Client full name or company name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Tax identifier' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Phone number' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiPropertyOptional({ description: 'Physical address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: 'Credit limit assigned to the client', default: 0 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit: number;

  @ApiPropertyOptional({ enum: ClientType, default: ClientType.INDIVIDUAL })
  @IsOptional()
  @IsEnum(ClientType)
  clientType?: ClientType;

  @ApiPropertyOptional({ description: 'Client related notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
