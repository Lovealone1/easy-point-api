import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TransactionType,
  OperationType,
  PaymentMethod,
} from '@prisma/client';

export class CreateFinancialTransactionDto {
  @ApiProperty({ description: 'ID of the bank account to debit or credit' })
  @IsNotEmpty()
  @IsString()
  bankAccountId: string;

  @ApiProperty({ enum: TransactionType, description: 'CREDIT = money in, DEBIT = money out' })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ description: 'Amount (must be positive)', minimum: 0.0001 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ enum: OperationType })
  @IsEnum(OperationType)
  operationType: OperationType;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
