import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SupplyStockEntryEntity } from './domain/supply-stock-entry.entity.js';

@Injectable()
export class SupplyStockEntriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.SupplyStockEntryUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplyStockEntryEntity> {
    const client = tx ?? this.prisma;
    const raw = await client.supplyStockEntry.create({ data });
    return SupplyStockEntryEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SupplyStockEntryWhereInput;
    orderBy?: Prisma.SupplyStockEntryOrderByWithRelationInput;
  }): Promise<[SupplyStockEntryEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.supplyStockEntry.findMany({ skip, take, where, orderBy }),
      this.prisma.supplyStockEntry.count({ where }),
    ]);
    return [rows.map(SupplyStockEntryEntity.fromPrisma), count];
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<SupplyStockEntryEntity | null> {
    const client = tx ?? this.prisma;
    const raw = await client.supplyStockEntry.findUnique({ where: { id } });
    return raw ? SupplyStockEntryEntity.fromPrisma(raw) : null;
  }

  /**
   * Devuelve los lotes activos (no agotados) de un SupplyStock
   * ordenados por createdAt ASC (estrategia FIFO).
   */
  async findAvailableByStockId(
    supplyStockId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplyStockEntryEntity[]> {
    const client = tx ?? this.prisma;
    const rows = await client.supplyStockEntry.findMany({
      where: { supplyStockId, isExhausted: false },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(SupplyStockEntryEntity.fromPrisma);
  }

  /**
   * Persiste el estado actual de un entry (remainingQuantity + isExhausted)
   * tras un consumo parcial o total.
   */
  async updateConsumption(
    id: string,
    remainingQuantity: Prisma.Decimal,
    isExhausted: boolean,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.supplyStockEntry.update({
      where: { id },
      data: { remainingQuantity, isExhausted },
    });
  }

  /**
   * Inicializa un entry en 0 para supplies que ya existían sin entry.
   * Solo crea si el SupplyStock no tiene ningún entry activo.
   */
  async initializeForStock(
    supplyStockId: string,
    organizationId: string,
    unitCost: Prisma.Decimal,
  ): Promise<SupplyStockEntryEntity> {
    const raw = await this.prisma.supplyStockEntry.create({
      data: {
        organizationId,
        supplyStockId,
        initialQuantity: new Prisma.Decimal(0),
        remainingQuantity: new Prisma.Decimal(0),
        unitCost,
        isExhausted: true, // entry vacío, no debe usarse para producción
      },
    });
    return SupplyStockEntryEntity.fromPrisma(raw);
  }
}
