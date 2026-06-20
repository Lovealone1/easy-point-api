import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { ExpenseCategoryEntity } from './domain/expense-category.entity.js';

@Injectable()
export class ExpenseCategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.ExpenseCategoryUncheckedCreateInput,
  ): Promise<ExpenseCategoryEntity> {
    const raw = await this.prisma.expenseCategory.create({ data });
    return ExpenseCategoryEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ExpenseCategoryWhereInput;
    orderBy?: Prisma.ExpenseCategoryOrderByWithRelationInput;
  }): Promise<[ExpenseCategoryEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.expenseCategory.findMany({ skip, take, where, orderBy }),
      this.prisma.expenseCategory.count({ where }),
    ]);
    return [rows.map(ExpenseCategoryEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<ExpenseCategoryEntity | null> {
    const raw = await this.prisma.expenseCategory.findUnique({ where: { id } });
    return raw ? ExpenseCategoryEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.ExpenseCategoryUncheckedUpdateInput,
  ): Promise<ExpenseCategoryEntity> {
    const raw = await this.prisma.expenseCategory.update({ where: { id }, data });
    return ExpenseCategoryEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<ExpenseCategoryEntity> {
    const raw = await this.prisma.expenseCategory.delete({ where: { id } });
    return ExpenseCategoryEntity.fromPrisma(raw);
  }
}
