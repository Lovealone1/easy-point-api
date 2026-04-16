import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationUsersRepository } from './organization-users.repository.js';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto.js';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto.js';
import { Role, Prisma } from '@prisma/client';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';

@Injectable()
export class OrganizationUsersService {
  constructor(private readonly organizationUsersRepository: OrganizationUsersRepository) {}

  async create(createOrganizationUserDto: CreateOrganizationUserDto) {
    const { userId, organizationId, role } = createOrganizationUserDto;
    
    // Check if the association already exists
    const existingDev = await this.organizationUsersRepository.findByUserIdAndOrganizationId(userId, organizationId);

    if (existingDev) {
      throw new ConflictException('User is already a member of this organization');
    }

    // Check OWNER rule
    if (role === 'OWNER') {
      const ownerCount = await this.organizationUsersRepository.countOwners(organizationId);

      if (ownerCount > 0) {
         throw new ConflictException('This organization already has an OWNER. Please demote or remove the current owner first.');
      }
    }

    return this.organizationUsersRepository.create({
      userId,
      organizationId,
      role: role || 'USER',
    });
  }

  async findAll(organizationId: string, pageOptionsDto: PageOptionsDto) {
    const skip = pageOptionsDto.skip;
    const take = pageOptionsDto.limit;
    
    const orderDirection = pageOptionsDto.order ? (pageOptionsDto.order.toLowerCase() as Prisma.SortOrder) : 'desc';
    const orderBy: Prisma.OrganizationUserOrderByWithRelationInput = pageOptionsDto.orderBy 
      ? ({ [pageOptionsDto.orderBy]: orderDirection } as Prisma.OrganizationUserOrderByWithRelationInput) 
      : { joinedAt: 'desc' };

    const where: Prisma.OrganizationUserWhereInput = {
      organizationId,
      ...(pageOptionsDto.search && {
        user: {
          OR: [
            { email: { contains: pageOptionsDto.search, mode: 'insensitive' as any } },
            { firstName: { contains: pageOptionsDto.search, mode: 'insensitive' as any } },
            { lastName: { contains: pageOptionsDto.search, mode: 'insensitive' as any } },
          ],
        },
      }),
    };

    const [data, itemCount] = await this.organizationUsersRepository.findManyWithCount({
      skip,
      take,
      orderBy,
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
    return new PageDto(data, pageMetaDto);
  }

  async findOne(id: string) {
    const member = await this.organizationUsersRepository.findById(id);
    
    if (!member) {
      throw new NotFoundException(`Organization User association with ID ${id} not found`);
    }

    return member;
  }

  async updateRole(id: string, updateOrganizationUserDto: UpdateOrganizationUserDto) {
    const member = await this.findOne(id);
    const newRole = updateOrganizationUserDto.role;

    if (newRole === 'OWNER' && member.role !== 'OWNER') {
      const ownerCount = await this.organizationUsersRepository.countOwners(member.organizationId);

      if (ownerCount > 0) {
         throw new ConflictException('This organization already has an OWNER. Please demote or remove the current owner first.');
      }
    }

    return this.organizationUsersRepository.updateRole(id, newRole);
  }

  async remove(id: string) {
    await this.findOne(id); // Ensure user association exists
    
    return this.organizationUsersRepository.delete(id);
  }
}
