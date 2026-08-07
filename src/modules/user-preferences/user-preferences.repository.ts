import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserPreferencesEntity } from './domain/user-preferences.entity.js';

@Injectable()
export class UserPreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reads the row, creating it with schema defaults if the user has never
   * touched their preferences. Lazy creation is why no backfill migration was
   * needed for existing users.
   */
  async findOrCreateForUser(userId: string): Promise<UserPreferencesEntity> {
    const raw = await this.prisma.userPreferences.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return UserPreferencesEntity.fromPrisma(raw);
  }

  async updateForUser(
    userId: string,
    data: Prisma.UserPreferencesUpdateInput,
  ): Promise<UserPreferencesEntity> {
    const raw = await this.prisma.userPreferences.update({ where: { userId }, data });
    return UserPreferencesEntity.fromPrisma(raw);
  }
}
