import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { RoleEntity } from './domain/role.entity.js';

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.RoleUncheckedCreateInput): Promise<RoleEntity> {
    const raw = await this.prisma.role.create({ data });
    return RoleEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.RoleWhereInput;
    orderBy?: Prisma.RoleOrderByWithRelationInput | Prisma.RoleOrderByWithRelationInput[];
  }): Promise<[RoleEntity[], number]> {
    const { skip, take, where, orderBy } = params;

    const [rows, count] = await Promise.all([
      this.prisma.role.findMany({ skip, take, where, orderBy }),
      this.prisma.role.count({ where }),
    ]);

    return [rows.map(RoleEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<RoleEntity | null> {
    const raw = await this.prisma.role.findUnique({ where: { id } });
    return raw ? RoleEntity.fromPrisma(raw) : null;
  }

  async findByNameAndOrg(name: string, organizationId: string): Promise<RoleEntity | null> {
    const raw = await this.prisma.role.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name,
        },
      },
    });
    return raw ? RoleEntity.fromPrisma(raw) : null;
  }

  async update(id: string, data: Prisma.RoleUpdateInput): Promise<RoleEntity> {
    const raw = await this.prisma.role.update({
      where: { id },
      data,
    });
    return RoleEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<RoleEntity> {
    const raw = await this.prisma.role.delete({ where: { id } });
    return RoleEntity.fromPrisma(raw);
  }
}
