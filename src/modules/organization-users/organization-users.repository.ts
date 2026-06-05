import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Role } from '../../common/enums/role.enum.js';
import { Prisma } from '@prisma/client';
import { OrganizationUserEntity } from './domain/organization-user.entity.js';

/**
 * Repository de OrganizationUser — capa de infraestructura.
 *
 * Responsabilidades:
 *  - Toda comunicación con la base de datos (Prisma).
 *  - Mapeo entre el modelo Prisma y la entidad de dominio OrganizationUserEntity.
 *
 * NO contiene lógica de negocio.
 */
@Injectable()
export class OrganizationUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Select fijo para include de user — evita duplicar la proyección en varios métodos */
  private readonly userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    isActive: true,
  } as const;

  async findByUserIdAndOrganizationId(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationUserEntity | null> {
    const raw = await this.prisma.organizationUser.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { role: true },
    });
    return raw ? OrganizationUserEntity.fromPrisma(raw) : null;
  }

  async countOwners(organizationId: string): Promise<number> {
    return this.prisma.organizationUser.count({
      where: { organizationId, role: { name: Role.OWNER } },
    });
  }

  async create(data: { userId: string; organizationId: string; role: string }): Promise<OrganizationUserEntity> {
    const raw = await this.prisma.organizationUser.create({
      data: {
        user: { connect: { id: data.userId } },
        organization: { connect: { id: data.organizationId } },
        role: { connect: { organizationId_name: { organizationId: data.organizationId, name: data.role } } }
      },
      include: { role: true }
    });
    return OrganizationUserEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.OrganizationUserWhereInput;
    orderBy?: Prisma.OrganizationUserOrderByWithRelationInput;
    includeUser?: boolean;
  }): Promise<[OrganizationUserEntity[], number]> {
    const { skip, take, where, orderBy, includeUser } = params;

    const include = includeUser
      ? { user: { select: this.userSelect } }
      : undefined;

    const [rows, count] = await Promise.all([
      this.prisma.organizationUser.findMany({ skip, take, where, orderBy, include: { ...include, role: true } }),
      this.prisma.organizationUser.count({ where }),
    ]);

    return [rows.map(OrganizationUserEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<OrganizationUserEntity | null> {
    const raw = await this.prisma.organizationUser.findUnique({ where: { id }, include: { role: true } });
    return raw ? OrganizationUserEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: { role?: string },
    currentEntity: OrganizationUserEntity,
  ): Promise<OrganizationUserEntity> {
    const updateData: Prisma.OrganizationUserUpdateInput = {};

    if (data.role) {
      updateData.role = {
        connect: {
          organizationId_name: {
            organizationId: currentEntity.organizationId,
            name: data.role,
          },
        },
      };
    }

    const raw = await this.prisma.organizationUser.update({
      where: { id },
      data: updateData,
      include: { role: true },
    });
    return OrganizationUserEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<OrganizationUserEntity> {
    const raw = await this.prisma.organizationUser.delete({ where: { id }, include: { role: true } });
    return OrganizationUserEntity.fromPrisma(raw);
  }
}
