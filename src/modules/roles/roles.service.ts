import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { RolesRepository } from './roles.repository.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { RoleEntity } from './domain/role.entity.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async create(
    organizationId: string,
    createRoleDto: CreateRoleDto,
  ): Promise<RoleEntity> {
    // Check if role name already exists in this organization
    const existing = await this.rolesRepository.findByNameAndOrg(
      createRoleDto.name,
      organizationId,
    );
    if (existing) {
      throw new ConflictException(
        `Role with name '${createRoleDto.name}' already exists in this organization`,
      );
    }

    return this.rolesRepository.create({
      organizationId,
      name: createRoleDto.name,
      description: createRoleDto.description,
      isSystemDefault: false, // User created roles are never system default
    });
  }

  async findAll(
    organizationId: string,
    pageOptionsDto: PageOptionsDto,
  ): Promise<PageDto<RoleEntity>> {
    const skip = pageOptionsDto.skip;
    const take = pageOptionsDto.limit;

    const orderDirection = pageOptionsDto.order
      ? (pageOptionsDto.order.toLowerCase() as Prisma.SortOrder)
      : 'desc';

    const orderByField = pageOptionsDto.orderBy ?? 'createdAt';

    const orderBy: Prisma.RoleOrderByWithRelationInput[] = [
      { isSystemDefault: 'desc' },
      { [orderByField]: orderDirection },
    ];

    const where: Prisma.RoleWhereInput = {
      organizationId,
      ...(pageOptionsDto.search && {
        name: { contains: pageOptionsDto.search, mode: 'insensitive' },
      }),
    };

    const [data, itemCount] = await this.rolesRepository.findManyWithCount({
      skip,
      take,
      orderBy,
      where,
    });

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
    return new PageDto(data, pageMetaDto);
  }

  async findOne(id: string, organizationId: string): Promise<RoleEntity> {
    const role = await this.rolesRepository.findById(id);

    if (!role || role.organizationId !== organizationId) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  async update(
    id: string,
    organizationId: string,
    updateRoleDto: UpdateRoleDto,
  ): Promise<RoleEntity> {
    const role = await this.findOne(id, organizationId);

    if (role.isSystemDefault) {
      throw new BadRequestException('Cannot modify a system default role');
    }

    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existing = await this.rolesRepository.findByNameAndOrg(
        updateRoleDto.name,
        organizationId,
      );
      if (existing) {
        throw new ConflictException(
          `Role with name '${updateRoleDto.name}' already exists in this organization`,
        );
      }
    }

    return this.rolesRepository.update(id, updateRoleDto);
  }

  async remove(id: string, organizationId: string): Promise<RoleEntity> {
    const role = await this.findOne(id, organizationId);

    if (role.isSystemDefault) {
      throw new BadRequestException('Cannot delete a system default role');
    }

    return this.rolesRepository.delete(id);
  }
}
