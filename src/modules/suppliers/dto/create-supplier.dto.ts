import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail, IsNumber, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplierDto {
  @ApiProperty({ description: 'The UUID of the organization' })
  @IsNotEmpty()
  @IsString()
  organizationId: string;

  @ApiProperty({ description: 'Supplier company or person name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Tax identifier (RUT / NIT / RFC)' })
  @IsNotEmpty()
  @IsString()
  taxId: string;

  @ApiProperty({ description: 'Supplier email address' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Supplier phone number' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Supplier physical address' })
  @IsNotEmpty()
  @IsString()
  address: string;

  @ApiPropertyOptional({ description: 'Bank account number or IBAN' })
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiProperty({ description: 'Lead time in days for order delivery', minimum: 0 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadTime: number;

  @ApiPropertyOptional({ description: 'Payment terms description (e.g. Net 30)' })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional({ description: 'Internal notes about this supplier' })
  @IsOptional()
  @IsString()
  notes?: string;
}
