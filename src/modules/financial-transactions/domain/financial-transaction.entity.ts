import {
  TransactionType,
  OperationType,
  PaymentMethod,
  Prisma,
} from '@prisma/client';

export class FinancialTransactionEntity {
  readonly id: string;
  readonly organizationId: string;
  readonly transactionNumber: string;
  readonly bankAccountId: string;
  readonly type: TransactionType;
  readonly amount: Prisma.Decimal;
  readonly balanceBefore: Prisma.Decimal;
  readonly balanceAfter: Prisma.Decimal;
  readonly operationType: OperationType;
  readonly referenceId: string | null;
  readonly referenceType: string | null;
  readonly categoryId: string | null;
  readonly paymentMethod: PaymentMethod | null;
  readonly description: string | null;
  readonly metadata: Prisma.JsonValue | null;
  readonly performedByUserId: string | null;
  readonly createdAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    transactionNumber: string;
    bankAccountId: string;
    type: TransactionType;
    amount: Prisma.Decimal;
    balanceBefore: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
    operationType: OperationType;
    referenceId: string | null;
    referenceType: string | null;
    categoryId: string | null;
    paymentMethod: PaymentMethod | null;
    description: string | null;
    metadata: Prisma.JsonValue | null;
    performedByUserId: string | null;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.transactionNumber = params.transactionNumber;
    this.bankAccountId = params.bankAccountId;
    this.type = params.type;
    this.amount = params.amount;
    this.balanceBefore = params.balanceBefore;
    this.balanceAfter = params.balanceAfter;
    this.operationType = params.operationType;
    this.referenceId = params.referenceId;
    this.referenceType = params.referenceType;
    this.categoryId = params.categoryId;
    this.paymentMethod = params.paymentMethod;
    this.description = params.description;
    this.metadata = params.metadata;
    this.performedByUserId = params.performedByUserId;
    this.createdAt = params.createdAt;
  }

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    transactionNumber: string;
    bankAccountId: string;
    type: TransactionType;
    amount: Prisma.Decimal;
    balanceBefore: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
    operationType: OperationType;
    referenceId: string | null;
    referenceType: string | null;
    categoryId: string | null;
    paymentMethod: PaymentMethod | null;
    description: string | null;
    metadata: Prisma.JsonValue | null;
    performedByUserId: string | null;
    createdAt: Date;
  }): FinancialTransactionEntity {
    return new FinancialTransactionEntity(raw);
  }
}
