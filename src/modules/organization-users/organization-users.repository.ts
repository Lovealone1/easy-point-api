import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, OrganizationUser } from '@prisma/client';

@Injectable()
export class OrganizationUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserIdAndOrganizationId(userId: string, organizationId: string): Promise<OrganizationUser | null> {
    return this.prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });
  }

  async countOwners(organizationId: string): Promise<number> {
    return this.prisma.organizationUser.count({
      where: {
        organizationId,
        role: 'OWNER',
      },
    });
  }

  async create(data: Prisma.OrganizationUserCreateInput | Prisma.OrganizationUserUncheckedCreateInput): Promise<OrganizationUser> {
    return this.prisma.organizationUser.create({ data });
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.OrganizationUserWhereInput;
    orderBy?: Prisma.OrganizationUserOrderByWithRelationInput;
    include?: Prisma.OrganizationUserInclude;
  }): Promise<[any[], number]> {
    const { skip, take, where, orderBy, include } = params;
    return Promise.all([
      this.prisma.organizationUser.findMany({ skip, take, where, orderBy, include }),
      this.prisma.organizationUser.count({ where }),
    ]);
  }

  async findById(id: string): Promise<OrganizationUser | null> {
    return this.prisma.organizationUser.findUnique({ where: { id } });
  }

  async updateRole(id: string, role: any): Promise<OrganizationUser> {
    return this.prisma.organizationUser.update({
      where: { id },
      data: { role },
    });
  }

  async delete(id: string): Promise<OrganizationUser> {
    return this.prisma.organizationUser.delete({
      where: { id },
    });
  }
}
