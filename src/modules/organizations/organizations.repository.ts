import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { OrganizationEntity } from './domain/organization.entity.js';

/**
 * Repository de Organization — capa de infraestructura.
 *
 * Responsabilidades:
 *  - Toda comunicación con la base de datos (Prisma).
 *  - Mapeo entre el modelo Prisma y la entidad de dominio OrganizationEntity.
 *
 * NO contiene lógica de negocio.
 */
@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.OrganizationCreateInput,
  ): Promise<OrganizationEntity> {
    const raw = await this.prisma.organization.create({ data });
    return OrganizationEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.OrganizationWhereInput;
    orderBy?: Prisma.OrganizationOrderByWithRelationInput;
  }): Promise<[OrganizationEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.organization.findMany({ skip, take, where, orderBy }),
      this.prisma.organization.count({ where }),
    ]);
    return [rows.map(OrganizationEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<OrganizationEntity | null> {
    const raw = await this.prisma.organization.findUnique({ where: { id } });
    return raw ? OrganizationEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.OrganizationUpdateInput,
  ): Promise<OrganizationEntity> {
    const raw = await this.prisma.organization.update({ where: { id }, data });
    return OrganizationEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<OrganizationEntity> {
    const raw = await this.prisma.organization.delete({ where: { id } });
    return OrganizationEntity.fromPrisma(raw);
  }
}
