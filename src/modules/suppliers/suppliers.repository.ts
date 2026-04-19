import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Supplier } from '@prisma/client';

@Injectable()
export class SuppliersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.SupplierUncheckedCreateInput): Promise<Supplier> {
    return this.prisma.supplier.create({ data });
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SupplierWhereInput;
    orderBy?: Prisma.SupplierOrderByWithRelationInput;
  }): Promise<[any[], number]> {
    const { skip, take, where, orderBy } = params;
    return Promise.all([
      this.prisma.supplier.findMany({ skip, take, where, orderBy }),
      this.prisma.supplier.count({ where }),
    ]);
  }

  async findById(id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.SupplierUncheckedUpdateInput): Promise<Supplier> {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Supplier> {
    return this.prisma.supplier.delete({ where: { id } });
  }
}
