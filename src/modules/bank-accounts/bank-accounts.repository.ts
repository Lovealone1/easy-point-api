import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { BankAccountEntity } from './domain/bank-account.entity.js';

@Injectable()
export class BankAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.BankAccountUncheckedCreateInput): Promise<BankAccountEntity> {
    const raw = await this.prisma.bankAccount.create({ data });
    return BankAccountEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.BankAccountWhereInput;
    orderBy?: Prisma.BankAccountOrderByWithRelationInput;
  }): Promise<[BankAccountEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.bankAccount.findMany({ skip, take, where, orderBy }),
      this.prisma.bankAccount.count({ where }),
    ]);
    return [rows.map(BankAccountEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<BankAccountEntity | null> {
    const raw = await this.prisma.bankAccount.findUnique({ where: { id } });
    return raw ? BankAccountEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.BankAccountUncheckedUpdateInput,
  ): Promise<BankAccountEntity> {
    const raw = await this.prisma.bankAccount.update({ where: { id }, data });
    return BankAccountEntity.fromPrisma(raw);
  }

  /**
   * Updates an account ensuring the version matches (optimistic locking).
   * Note: We increment the version automatically here.
   */
  async updateWithVersion(
    id: string,
    currentVersion: number,
    data: Prisma.BankAccountUncheckedUpdateInput,
  ): Promise<BankAccountEntity> {
    const raw = await this.prisma.bankAccount.update({
      where: { id, version: currentVersion },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
    return BankAccountEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<BankAccountEntity> {
    const raw = await this.prisma.bankAccount.delete({ where: { id } });
    return BankAccountEntity.fromPrisma(raw);
  }
}
