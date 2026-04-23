import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Role } from '@prisma/client';
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
    });
    return raw ? OrganizationUserEntity.fromPrisma(raw) : null;
  }

  async countOwners(organizationId: string): Promise<number> {
    return this.prisma.organizationUser.count({
      where: { organizationId, role: Role.OWNER },
    });
  }

  async create(
    data: Prisma.OrganizationUserUncheckedCreateInput,
  ): Promise<OrganizationUserEntity> {
    const raw = await this.prisma.organizationUser.create({ data });
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
      this.prisma.organizationUser.findMany({ skip, take, where, orderBy, include }),
      this.prisma.organizationUser.count({ where }),
    ]);

    return [rows.map(OrganizationUserEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<OrganizationUserEntity | null> {
    const raw = await this.prisma.organizationUser.findUnique({ where: { id } });
    return raw ? OrganizationUserEntity.fromPrisma(raw) : null;
  }

  async updateRole(id: string, role: Role): Promise<OrganizationUserEntity> {
    const raw = await this.prisma.organizationUser.update({
      where: { id },
      data: { role },
    });
    return OrganizationUserEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<OrganizationUserEntity> {
    const raw = await this.prisma.organizationUser.delete({ where: { id } });
    return OrganizationUserEntity.fromPrisma(raw);
  }
}
