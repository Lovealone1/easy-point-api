import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OrganizationUsersRepository } from './organization-users.repository.js';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto.js';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto.js';
import { FindOrganizationUsersDto } from './dto/find-organization-users.dto.js';
import { Role } from '../../common/enums/role.enum.js';
import { Prisma } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { OrganizationUserEntity } from './domain/organization-user.entity.js';
import { getTenantId } from '../../common/context/tenant.context.js';


/**
 * Service de OrganizationUser — capa de aplicación (orquestación).
 *
 * Responsabilidades:
 *  - Verificar existencia de recursos y lanzar excepciones HTTP apropiadas.
 *  - Obtener datos de apoyo (ownerCount) necesarios para que la entidad
 *    evalúe sus invariantes (canAssignRole).
 *  - Traducir el resultado de la entidad en excepciones HTTP (ConflictException).
 *  - Coordinar el flujo entre el repositorio y la entidad de dominio.
 *
 * NO contiene lógica de negocio. La regla de unicidad de OWNER y el
 * cambio de rol viven en OrganizationUserEntity.
 */
@Injectable()
export class OrganizationUsersService {
  constructor(
    private readonly organizationUsersRepository: OrganizationUsersRepository,
  ) {}

  async create(
    createOrganizationUserDto: CreateOrganizationUserDto,
  ): Promise<OrganizationUserEntity> {
    const { userId, role } = createOrganizationUserDto;
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    // Verificar membresía duplicada
    const existing =
      await this.organizationUsersRepository.findByUserIdAndOrganizationId(
        userId,
        organizationId,
      );
    if (existing) {
      throw new ConflictException(
        'User is already a member of this organization',
      );
    }

    // Verificar invariante de único OWNER via la entidad
    const assignedRole = role ?? Role.USER;
    if (assignedRole === Role.OWNER) {
      const ownerCount =
        await this.organizationUsersRepository.countOwners(organizationId);

      if (!OrganizationUserEntity.canAssignRole(Role.OWNER, ownerCount)) {
        throw new ConflictException(
          'This organization already has an OWNER. Please demote or remove the current owner first.',
        );
      }
    }

    return this.organizationUsersRepository.create({
      userId,
      organizationId,
      role: assignedRole,
    });
  }

  async findAll(
    query: FindOrganizationUsersDto,
  ): Promise<PageDto<OrganizationUserEntity>> {
    const where: Prisma.OrganizationUserWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.organizationId) where.organizationId = query.organizationId;

    if (query.search) {
      where.user = {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const orderDirection = query.order
      ? (query.order.toLowerCase() as Prisma.SortOrder)
      : 'desc';

    // OrganizationUser usa joinedAt en vez de createdAt
    const orderByField =
      query.orderBy === 'createdAt'
        ? 'joinedAt'
        : (query.orderBy ?? 'joinedAt');

    const orderBy: Prisma.OrganizationUserOrderByWithRelationInput = {
      [orderByField]: orderDirection,
    };

    const [data, itemCount] =
      await this.organizationUsersRepository.findManyWithCount({
        skip: query.skip,
        take: query.limit,
        orderBy,
        where,
        includeUser: true,
      });

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(data, pageMetaDto);
  }

  async findOne(id: string): Promise<OrganizationUserEntity> {
    const member = await this.organizationUsersRepository.findById(id);

    if (!member) {
      throw new NotFoundException(
        `Organization User association with ID ${id} not found`,
      );
    }

    return member;
  }

  async update(
    id: string,
    updateOrganizationUserDto: UpdateOrganizationUserDto,
  ): Promise<OrganizationUserEntity> {
    const member = await this.findOne(id);
    const newRole = updateOrganizationUserDto.role;

    if (!newRole) {
      return member;
    }

    // La entidad evalúa el invariante — el service provee los datos de contexto
    const ownerCount = await this.organizationUsersRepository.countOwners(
      member.organizationId,
    );

    if (!OrganizationUserEntity.canAssignRole(newRole, ownerCount, member.role)) {
      throw new ConflictException(
        'This organization already has an OWNER. Please demote or remove the current owner first.',
      );
    }

    // La entidad aplica el cambio de rol antes de persistir
    member.applyRoleChange(newRole);

    return this.organizationUsersRepository.update(id, { role: newRole }, member);
  }

  async remove(id: string): Promise<OrganizationUserEntity> {
    await this.findOne(id);
    return this.organizationUsersRepository.delete(id);
  }
}
