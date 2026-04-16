import { IsString, IsNotEmpty, MaxLength, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Plan, OrganizationStatus } from '@prisma/client';

export class CreateOrganizationDto {
  @ApiProperty({ description: 'The name of the organization', example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Contact email', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Unique slug for URL', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  slug?: string;

  @ApiProperty({ enum: Plan, required: false })
  @IsEnum(Plan)
  @IsOptional()
  plan?: Plan;

  @ApiProperty({ enum: OrganizationStatus, required: false })
  @IsEnum(OrganizationStatus)
  @IsOptional()
  status?: OrganizationStatus;
}
