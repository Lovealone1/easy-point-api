import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { FinancialTransactionEntity } from './domain/financial-transaction.entity.js';

const TRANSACTION_INCLUDE = {
  bankAccount: { select: { name: true } },
  category: { select: { name: true } },
  performedBy: { select: { email: true } },
} satisfies Prisma.FinancialTransactionInclude;

@Injectable()
export class FinancialTransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inserts a financial transaction record.
   * Accepts an optional TransactionClient (`tx`) to participate in an outer
   * atomic block — this is the primary usage path from createTransaction().
   */
  async create(
    data: Prisma.FinancialTransactionUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<FinancialTransactionEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.financialTransaction.create({ data, include: TRANSACTION_INCLUDE });
    return FinancialTransactionEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.FinancialTransactionWhereInput;
    orderBy?: Prisma.FinancialTransactionOrderByWithRelationInput;
  }): Promise<[FinancialTransactionEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.financialTransaction.findMany({ skip, take, where, orderBy, include: TRANSACTION_INCLUDE }),
      this.prisma.financialTransaction.count({ where }),
    ]);
    return [rows.map(FinancialTransactionEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<FinancialTransactionEntity | null> {
    const raw = await this.prisma.financialTransaction.findUnique({
      where: { id },
      include: TRANSACTION_INCLUDE,
    });
    return raw ? FinancialTransactionEntity.fromPrisma(raw) : null;
  }

  async delete(id: string, tx?: Prisma.TransactionClient): Promise<FinancialTransactionEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.financialTransaction.delete({
      where: { id },
      include: TRANSACTION_INCLUDE,
    });
    return FinancialTransactionEntity.fromPrisma(raw);
  }
}
