import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SupplierEntity } from './domain/supplier.entity.js';
@Injectable()
export class SuppliersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.SupplierUncheckedCreateInput): Promise<SupplierEntity> {
    const raw = await this.prisma.supplier.create({ data });
    return SupplierEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SupplierWhereInput;
    orderBy?: Prisma.SupplierOrderByWithRelationInput;
  }): Promise<[SupplierEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.supplier.findMany({ skip, take, where, orderBy }),
      this.prisma.supplier.count({ where }),
    ]);
    return [rows.map(SupplierEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<SupplierEntity | null> {
    const raw = await this.prisma.supplier.findUnique({ where: { id } });
    return raw ? SupplierEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.SupplierUncheckedUpdateInput,
    currentEntity?: SupplierEntity
  ): Promise<SupplierEntity> {
    const raw = await this.prisma.supplier.update({ where: { id }, data });
    return SupplierEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<SupplierEntity> {
    const raw = await this.prisma.supplier.delete({ where: { id } });
    return SupplierEntity.fromPrisma(raw);
  }
}
