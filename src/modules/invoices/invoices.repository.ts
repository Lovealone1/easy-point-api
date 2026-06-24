import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { InvoiceEntity } from './domain/invoice.entity.js';

@Injectable()
export class InvoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.InvoiceUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<InvoiceEntity> {
    const prismaClient = tx || this.prisma;
    const raw = await prismaClient.invoice.create({
      data,
      include: { subscription: { include: { plan: true } } },
    });
    return InvoiceEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.InvoiceWhereInput;
    orderBy?: Prisma.InvoiceOrderByWithRelationInput;
  }, tx?: Prisma.TransactionClient): Promise<[InvoiceEntity[], number]> {
    const prismaClient = tx || this.prisma;
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      prismaClient.invoice.findMany({
        skip,
        take,
        where,
        orderBy,
        include: { subscription: { include: { plan: true } } },
      }),
      prismaClient.invoice.count({ where }),
    ]);
    return [rows.map(InvoiceEntity.fromPrisma), count];
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<InvoiceEntity | null> {
    const prismaClient = tx || this.prisma;
    const raw = await prismaClient.invoice.findUnique({
      where: { id },
      include: { subscription: { include: { plan: true } } },
    });
    return raw ? InvoiceEntity.fromPrisma(raw) : null;
  }

  async updateStatus(
    id: string,
    status: any,
    tx?: Prisma.TransactionClient,
  ): Promise<InvoiceEntity> {
    const prismaClient = tx || this.prisma;
    const raw = await prismaClient.invoice.update({
      where: { id },
      data: { status },
      include: { subscription: { include: { plan: true } } },
    });
    return InvoiceEntity.fromPrisma(raw);
  }
}
