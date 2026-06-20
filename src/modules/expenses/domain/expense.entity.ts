import { Prisma } from '@prisma/client';

export class ExpenseEntity {
  readonly id: string;
  readonly organizationId: string;
  categoryId: string;
  bankAccountId: string;
  amount: Prisma.Decimal;
  description: string | null;
  transactionId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    categoryId: string;
    bankAccountId: string;
    amount: Prisma.Decimal;
    description: string | null;
    transactionId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.categoryId = params.categoryId;
    this.bankAccountId = params.bankAccountId;
    this.amount = params.amount;
    this.description = params.description;
    this.transactionId = params.transactionId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    categoryId: string;
    bankAccountId: string;
    amount: Prisma.Decimal;
    description: string | null;
    transactionId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ExpenseEntity {
    return new ExpenseEntity({
      id: raw.id,
      organizationId: raw.organizationId,
      categoryId: raw.categoryId,
      bankAccountId: raw.bankAccountId,
      amount: raw.amount,
      description: raw.description,
      transactionId: raw.transactionId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
