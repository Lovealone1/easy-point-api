import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SaleStatus, PaymentMethod } from '@prisma/client';

// ─── Sub-DTO: one product line ────────────────────────────────────────────────

export class CreateSaleItemDto {
  @ApiProperty({
    description: 'Product ID being sold (must belong to this organization)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsNotEmpty()
  @IsString()
  productId: string;

  @ApiPropertyOptional({
    description: 'Stock location to deduct from (defaults to "Principal")',
    example: 'Principal',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    description: 'Quantity sold (positive, up to 4 decimal places)',
    example: 3,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    description: 'Unit sale price for this product line',
    example: 15000.00,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  unitPrice: number;
}

// ─── Main DTO ─────────────────────────────────────────────────────────────────

export class CreateSaleDto {
  @ApiPropertyOptional({
    description: 'Client ID (optional — can be anonymous sale)',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({
    enum: SaleStatus,
    default: SaleStatus.COMPLETED,
    example: SaleStatus.COMPLETED,
    description:
      'PENDING = registers inventory decrements only (acts as quote / pending order — no financial credit). ' +
      'COMPLETED = also credits the bank account atomically.',
  })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus = SaleStatus.COMPLETED;

  @ApiPropertyOptional({
    description: 'Required when status = COMPLETED. Bank account to credit.',
    example: 'd4e5f6a7-b8c9-0123-defa-234567890123',
  })
  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
    description:
      'Required when status = COMPLETED. ' +
      'Stored on the resulting FinancialTransaction for payment traceability.',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'TransactionCategory ID. Only used when status = COMPLETED.',
    example: 'e5f6a7b8-c9d0-1234-efab-345678901234',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'Venta mostrador — cliente frecuente',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [CreateSaleItemDto],
    description: 'List of products sold (at least one required)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];
}
