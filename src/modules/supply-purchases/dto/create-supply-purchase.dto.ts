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

// ─── Sub-DTO: one supply line ─────────────────────────────────────────────────

export class CreateSupplyPurchaseItemDto {
  @ApiProperty({
    description: 'Supply (insumo) ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsNotEmpty()
  @IsString()
  supplyId: string;

  @ApiPropertyOptional({
    description: 'Location of the stock (defaults to "Principal")',
    example: 'Principal',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    description: 'Quantity purchased (positive, up to 4 decimal places)',
    example: 10.5,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Unit cost paid for this supply line',
    example: 2500.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  unitCost?: number;
}

// ─── Main DTO ─────────────────────────────────────────────────────────────────

export class CreateSupplyPurchaseDto {
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
      'PENDING = registers stock movements only (no financial transaction). ' +
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
    example: PaymentMethod.CASH,
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
      'Categorizes the FinancialTransaction that is created on the bank account ' +
      '(e.g. "Compras de Insumos"). Not stored on the purchase record.',
    example: 'e5f6a7b8-c9d0-1234-efab-345678901234',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'Compra mensual de insumos de limpieza',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [CreateSupplyPurchaseItemDto],
    description: 'List of supplies purchased (at least one required)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSupplyPurchaseItemDto)
  items: CreateSupplyPurchaseItemDto[];
}

