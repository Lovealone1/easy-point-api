import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Supply } from '@prisma/client';

@Injectable()
export class SuppliesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula pricePerUnit = basePrice / packageSize.
   * Debe llamarse antes de cada create y en cada update que toque basePrice o packageSize.
   */
  private calcPricePerUnit(
    basePrice: Prisma.Decimal,
    packageSize: Prisma.Decimal,
  ): Prisma.Decimal {
    return basePrice.div(packageSize);
  }

  async create(
    data: Omit<Prisma.SupplyUncheckedCreateInput, 'pricePerUnit' | 'quantityInStock'> & {
      basePrice: Prisma.Decimal | number | string;
      packageSize: Prisma.Decimal | number | string;
    },
  ): Promise<Supply> {
    const basePrice = new Prisma.Decimal(data.basePrice);
    const packageSize = new Prisma.Decimal(data.packageSize);
    const pricePerUnit = this.calcPricePerUnit(basePrice, packageSize);

    return this.prisma.supply.create({
      data: {
        ...data,
        basePrice,
        packageSize,
        pricePerUnit,
        // quantityInStock parte en 0 por @default del schema
      },
    });
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SupplyWhereInput;
    orderBy?: Prisma.SupplyOrderByWithRelationInput;
  }): Promise<[Supply[], number]> {
    const { skip, take, where, orderBy } = params;
    return Promise.all([
      this.prisma.supply.findMany({ skip, take, where, orderBy }),
      this.prisma.supply.count({ where }),
    ]);
  }

  async findById(id: string): Promise<Supply | null> {
    return this.prisma.supply.findUnique({ where: { id } });
  }

  /**
   * Actualiza un supply.
   * Si se modifica basePrice o packageSize, recalcula pricePerUnit automáticamente.
   * quantityInStock está bloqueado en este método (usa updateStock en su lugar).
   */
  async update(
    id: string,
    data: Omit<Prisma.SupplyUncheckedUpdateInput, 'pricePerUnit' | 'quantityInStock'>,
    currentSupply: Supply,
  ): Promise<Supply> {
    const newBasePrice = data.basePrice !== undefined
      ? new Prisma.Decimal(data.basePrice as string | number)
      : currentSupply.basePrice;

    const newPackageSize = data.packageSize !== undefined
      ? new Prisma.Decimal(data.packageSize as string | number)
      : currentSupply.packageSize;

    const pricePerUnit = this.calcPricePerUnit(newBasePrice, newPackageSize);

    return this.prisma.supply.update({
      where: { id },
      data: {
        ...data,
        basePrice: newBasePrice,
        packageSize: newPackageSize,
        pricePerUnit,
      },
    });
  }

  /**
   * Endpoint exclusivo para gestión de inventario.
   * Único método autorizado a modificar quantityInStock.
   */
  async updateStock(id: string, quantityInStock: Prisma.Decimal): Promise<Supply> {
    return this.prisma.supply.update({
      where: { id },
      data: { quantityInStock },
    });
  }

  async delete(id: string): Promise<Supply> {
    return this.prisma.supply.delete({ where: { id } });
  }
}
