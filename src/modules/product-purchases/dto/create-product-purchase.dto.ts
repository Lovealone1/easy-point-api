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
import { PurchaseStatus, PaymentMethod } from '@prisma/client';

// ─── Sub-DTO: one product line ────────────────────────────────────────────────

export class CreateProductPurchaseItemDto {
  @ApiProperty({
    description: 'Product ID (must belong to this organization and have isPurchased = true)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsNotEmpty()
  @IsString()
  productId: string;

  @ApiPropertyOptional({
    description: 'Stock location (defaults to "Principal")',
    example: 'Principal',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    description: 'Quantity purchased (positive, up to 4 decimal places)',
    example: 50,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Unit cost paid for this product line',
    example: 8500.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  unitCost?: number;
}

// ─── Main DTO ─────────────────────────────────────────────────────────────────

export class CreateProductPurchaseDto {
  @ApiPropertyOptional({
    description: 'Supplier ID (optional — can be unregistered)',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({
    enum: PurchaseStatus,
    default: PurchaseStatus.COMPLETED,
    example: PurchaseStatus.COMPLETED,
    description:
      'PENDING = registers inventory movements only (no financial transaction). ' +
      'COMPLETED = also debits the bank account atomically.',
  })
  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus = PurchaseStatus.COMPLETED;

  @ApiPropertyOptional({
    description: 'Required when status = COMPLETED. Bank account to debit.',
    example: 'd4e5f6a7-b8c9-0123-defa-234567890123',
  })
  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    example: PaymentMethod.BANK_TRANSFER,
    description:
      'Only used when status = COMPLETED. ' +
      'Stored on the resulting FinancialTransaction, NOT on the purchase itself.',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description:
      'TransactionCategory ID. Only used when status = COMPLETED. ' +
      'Categorizes the FinancialTransaction (e.g. "Compras de Productos"). Not stored on the purchase record.',
    example: 'e5f6a7b8-c9d0-1234-efab-345678901234',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'Compra de productos para reabastecimiento de temporada',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [CreateProductPurchaseItemDto],
    description: 'List of products purchased (at least one required)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductPurchaseItemDto)
  items: CreateProductPurchaseItemDto[];
}
