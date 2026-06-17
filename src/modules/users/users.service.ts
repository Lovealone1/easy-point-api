import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository.js';
import { UserEntity } from './domain/user.entity.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(pageOptionsDto: PageOptionsDto): Promise<PageDto<UserEntity>> {
    const skip = pageOptionsDto.skip;
    const take = pageOptionsDto.limit;

    const orderDirection = pageOptionsDto.order
      ? (pageOptionsDto.order.toLowerCase() as Prisma.SortOrder)
      : 'desc';

    const orderBy: Prisma.UserOrderByWithRelationInput = pageOptionsDto.orderBy
      ? ({ [pageOptionsDto.orderBy]: orderDirection } as Prisma.UserOrderByWithRelationInput)
      : { createdAt: 'desc' };

    const where: Prisma.UserWhereInput = pageOptionsDto.search
      ? {
          OR: [
            { email: { contains: pageOptionsDto.search, mode: 'insensitive' } },
            { firstName: { contains: pageOptionsDto.search, mode: 'insensitive' } },
            { lastName: { contains: pageOptionsDto.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, itemCount] = await this.usersRepository.findManyWithCount({
      skip,
      take,
      orderBy,
      where,
    });

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
    return new PageDto(data, pageMetaDto);
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    await this.findOne(id);
    return this.usersRepository.update(id, dto);
  }

  async updateRole(id: string, dto: UpdateUserRoleDto): Promise<UserEntity> {
    await this.findOne(id);
    return this.usersRepository.update(id, { globalRole: dto.globalRole });
  }

  async remove(id: string): Promise<UserEntity> {
    await this.findOne(id);
    return this.usersRepository.delete(id);
  }
}
