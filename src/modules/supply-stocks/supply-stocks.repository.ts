import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SupplyStockEntity } from './domain/supply-stock.entity.js';

@Injectable()
export class SupplyStocksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.SupplyStockUncheckedCreateInput): Promise<SupplyStockEntity> {
    const raw = await this.prisma.supplyStock.create({ data });
    return SupplyStockEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SupplyStockWhereInput;
    orderBy?: Prisma.SupplyStockOrderByWithRelationInput;
  }): Promise<[SupplyStockEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.supplyStock.findMany({ skip, take, where, orderBy }),
      this.prisma.supplyStock.count({ where }),
    ]);
    return [rows.map(SupplyStockEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<SupplyStockEntity | null> {
    const raw = await this.prisma.supplyStock.findUnique({ where: { id } });
    return raw ? SupplyStockEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.SupplyStockUncheckedUpdateInput,
    currentEntity?: SupplyStockEntity
  ): Promise<SupplyStockEntity> {
    const raw = await this.prisma.supplyStock.update({ 
      where: { id }, 
      data: currentEntity ? { ...data, quantity: currentEntity.quantity } : data 
    });
    return SupplyStockEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<SupplyStockEntity> {
    const raw = await this.prisma.supplyStock.delete({ where: { id } });
    return SupplyStockEntity.fromPrisma(raw);
  }
}
