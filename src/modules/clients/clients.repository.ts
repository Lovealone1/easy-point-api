import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Client } from '@prisma/client';

@Injectable()
export class ClientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ClientUncheckedCreateInput): Promise<Client> {
    return this.prisma.client.create({ data });
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ClientWhereInput;
    orderBy?: Prisma.ClientOrderByWithRelationInput;
  }): Promise<[any[], number]> {
    const { skip, take, where, orderBy } = params;
    return Promise.all([
      this.prisma.client.findMany({ skip, take, where, orderBy }),
      this.prisma.client.count({ where }),
    ]);
  }

  async findById(id: string): Promise<Client | null> {
    return this.prisma.client.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.ClientUncheckedUpdateInput): Promise<Client> {
    return this.prisma.client.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Client> {
    return this.prisma.client.delete({
      where: { id },
    });
  }
}
