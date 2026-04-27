import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

/**
 * Used by PATCH /supply-purchases/:id/complete
 * Transitions a PENDING purchase to COMPLETED and triggers the financial debit.
 */
export class CompleteSupplyPurchaseDto {
  @ApiProperty({ description: 'Bank account to debit the total purchase amount from' })
  @IsNotEmpty()
  @IsString()
  bankAccountId: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'TransactionCategory ID for the financial record' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Additional notes for this completion' })
  @IsOptional()
  @IsString()
  notes?: string;
}
