import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CurrencyEntity } from './domain/currency.entity.js';

@Injectable()
export class CurrenciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The whole catalog, popular first. Callers slice it in memory — at ~160
   * static rows, filtering in the database buys nothing and would defeat the
   * service-level cache.
   */
  async findAll(): Promise<CurrencyEntity[]> {
    const rows = await this.prisma.currency.findMany({
      orderBy: [{ isPopular: 'desc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    });
    return rows.map(CurrencyEntity.fromPrisma);
  }
}
