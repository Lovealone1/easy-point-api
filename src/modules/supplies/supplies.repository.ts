import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { SupplyEntity } from './domain/supply.entity.js';

@Injectable()
export class SuppliesRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(
    data: Omit<Prisma.SupplyUncheckedCreateInput, 'pricePerUnit'> & {
      basePrice: Prisma.Decimal;
      packageSize: Prisma.Decimal;
    },
  ): Promise<SupplyEntity> {
    const entity = SupplyEntity.fromPrisma({
      id: '',
      name: data.name,
      description: data.description ?? null,
      unitOfMeasure: data.unitOfMeasure,
      basePrice: new Prisma.Decimal(data.basePrice),
      packageSize: new Prisma.Decimal(data.packageSize),
      pricePerUnit: new Prisma.Decimal(0),
      quantityInStock: data.quantityInStock
        ? new Prisma.Decimal(data.quantityInStock as string | number)
        : new Prisma.Decimal(0),
      isActive: true,
      notes: (data.notes as string) ?? null,
      organizationId: data.organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    entity.applyPriceChange();

    const raw = await this.prisma.supply.create({
      data: {
        ...data,
        basePrice: entity.basePrice,
        packageSize: entity.packageSize,
        pricePerUnit: entity.pricePerUnit,
      },
    });

    return SupplyEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SupplyWhereInput;
    orderBy?: Prisma.SupplyOrderByWithRelationInput;
  }): Promise<[SupplyEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.supply.findMany({ skip, take, where, orderBy }),
      this.prisma.supply.count({ where }),
    ]);
    return [rows.map(SupplyEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<SupplyEntity | null> {
    const raw = await this.prisma.supply.findUnique({ where: { id } });
    return raw ? SupplyEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Omit<Prisma.SupplyUncheckedUpdateInput, 'pricePerUnit' | 'quantityInStock'>,
    currentEntity: SupplyEntity,
  ): Promise<SupplyEntity> {
    const newBasePrice =
      data.basePrice !== undefined
        ? new Prisma.Decimal(data.basePrice as string | number)
        : undefined;

    const newPackageSize =
      data.packageSize !== undefined
        ? new Prisma.Decimal(data.packageSize as string | number)
        : undefined;

    // La entidad aplica el cambio de precio y recalcula el invariante
    currentEntity.applyPriceChange(newBasePrice, newPackageSize);

    const raw = await this.prisma.supply.update({
      where: { id },
      data: {
        ...data,
        basePrice: currentEntity.basePrice,
        packageSize: currentEntity.packageSize,
        pricePerUnit: currentEntity.pricePerUnit,
      },
    });

    return SupplyEntity.fromPrisma(raw);
  }

  async updateStock(
    id: string,
    quantityInStock: Prisma.Decimal,
  ): Promise<SupplyEntity> {
    const raw = await this.prisma.supply.update({
      where: { id },
      data: { quantityInStock },
    });
    return SupplyEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<SupplyEntity> {
    const raw = await this.prisma.supply.delete({ where: { id } });
    return SupplyEntity.fromPrisma(raw);
  }
}
