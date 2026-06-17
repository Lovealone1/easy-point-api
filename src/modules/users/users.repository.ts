import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { UserEntity } from './domain/user.entity.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<[UserEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.user.findMany({ skip, take, where, orderBy }),
      this.prisma.user.count({ where }),
    ]);
    return [rows.map(UserEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    return raw ? UserEntity.fromPrisma(raw) : null;
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<UserEntity> {
    const raw = await this.prisma.user.update({ where: { id }, data });
    return UserEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<UserEntity> {
    const raw = await this.prisma.user.delete({ where: { id } });
    return UserEntity.fromPrisma(raw);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findUnique({ where: { email } });
    return raw ? UserEntity.fromPrisma(raw) : null;
  }

  async revokeRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
