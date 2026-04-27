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

  async findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<BankAccountEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.bankAccount.findUnique({ where: { id } });
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
   * Accepts an optional Prisma TransactionClient (`tx`) so this operation
   * can participate in an outer atomic block managed by the caller.
   */
  async updateWithVersion(
    id: string,
    currentVersion: number,
    data: Prisma.BankAccountUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<BankAccountEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.bankAccount.update({
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
