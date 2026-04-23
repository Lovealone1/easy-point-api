import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { ClientEntity } from './domain/client.entity.js';

/**
 * Repository de Client — capa de infraestructura.
 *
 * Responsabilidades:
 *  - Toda comunicación con la base de datos (Prisma).
 *  - Mapeo entre el modelo Prisma y la entidad de dominio ClientEntity.
 *
 * NO contiene lógica de negocio.
 */
@Injectable()
export class ClientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.ClientUncheckedCreateInput,
  ): Promise<ClientEntity> {
    const raw = await this.prisma.client.create({ data });
    return ClientEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ClientWhereInput;
    orderBy?: Prisma.ClientOrderByWithRelationInput;
  }): Promise<[ClientEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.client.findMany({ skip, take, where, orderBy }),
      this.prisma.client.count({ where }),
    ]);
    return [rows.map(ClientEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<ClientEntity | null> {
    const raw = await this.prisma.client.findUnique({ where: { id } });
    return raw ? ClientEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.ClientUncheckedUpdateInput,
  ): Promise<ClientEntity> {
    const raw = await this.prisma.client.update({ where: { id }, data });
    return ClientEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<ClientEntity> {
    const raw = await this.prisma.client.delete({ where: { id } });
    return ClientEntity.fromPrisma(raw);
  }
}
