import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { TransactionCategoryEntity } from './domain/transaction-category.entity.js';

@Injectable()
export class TransactionCategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.TransactionCategoryUncheckedCreateInput): Promise<TransactionCategoryEntity> {
    const raw = await this.prisma.transactionCategory.create({ data });
    return TransactionCategoryEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.TransactionCategoryWhereInput;
    orderBy?: Prisma.TransactionCategoryOrderByWithRelationInput;
  }): Promise<[TransactionCategoryEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.transactionCategory.findMany({ skip, take, where, orderBy }),
      this.prisma.transactionCategory.count({ where }),
    ]);
    return [rows.map(TransactionCategoryEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<TransactionCategoryEntity | null> {
    const raw = await this.prisma.transactionCategory.findUnique({ where: { id } });
    return raw ? TransactionCategoryEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.TransactionCategoryUncheckedUpdateInput,
  ): Promise<TransactionCategoryEntity> {
    const raw = await this.prisma.transactionCategory.update({ where: { id }, data });
    return TransactionCategoryEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<TransactionCategoryEntity> {
    const raw = await this.prisma.transactionCategory.delete({ where: { id } });
    return TransactionCategoryEntity.fromPrisma(raw);
  }
}
