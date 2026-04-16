import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Organization } from '@prisma/client';

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return this.prisma.organization.create({ data });
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.OrganizationWhereInput;
    orderBy?: Prisma.OrganizationOrderByWithRelationInput;
  }): Promise<[Organization[], number]> {
    const { skip, take, where, orderBy } = params;
    return Promise.all([
      this.prisma.organization.findMany({ skip, take, where, orderBy }),
      this.prisma.organization.count({ where }),
    ]);
  }

  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.OrganizationUpdateInput): Promise<Organization> {
    return this.prisma.organization.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Organization> {
    return this.prisma.organization.delete({
      where: { id },
    });
  }
}
