import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { ExpenseEntity } from './domain/expense.entity.js';

@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.ExpenseUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ExpenseEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.expense.create({ data });
    return ExpenseEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ExpenseWhereInput;
    orderBy?: Prisma.ExpenseOrderByWithRelationInput;
  }): Promise<[ExpenseEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.expense.findMany({ skip, take, where, orderBy }),
      this.prisma.expense.count({ where }),
    ]);
    return [rows.map(ExpenseEntity.fromPrisma), count];
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<ExpenseEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.expense.findUnique({ where: { id } });
    return raw ? ExpenseEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.ExpenseUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ExpenseEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.expense.update({ where: { id }, data });
    return ExpenseEntity.fromPrisma(raw);
  }

  async delete(id: string, tx?: Prisma.TransactionClient): Promise<ExpenseEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.expense.delete({ where: { id } });
    return ExpenseEntity.fromPrisma(raw);
  }
}
