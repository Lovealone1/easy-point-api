import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

/**
 * Used by PATCH /sales/:id/complete
 * Transitions a PENDING sale to COMPLETED, credits the bank account.
 * paymentMethod is REQUIRED here for correct financial traceability.
 */
export class CompleteSaleDto {
  @ApiProperty({ description: 'Bank account to credit the total sale amount to' })
  @IsNotEmpty()
  @IsString()
  bankAccountId: string;

  @ApiProperty({
    enum: PaymentMethod,
    description:
      'Payment method used. Required for correct financial traceability ' +
      '(cash, card, transfer, etc.).',
  })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ description: 'TransactionCategory ID for the financial record' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
