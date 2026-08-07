import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CurrenciesRepository } from './currencies.repository.js';
import { CurrencyEntity } from './domain/currency.entity.js';
import { FindCurrenciesDto } from './dto/find-currencies.dto.js';

@Injectable()
export class CurrenciesService {
  /**
   * In-process cache of the whole catalog. The table is seed-managed and has
   * no write endpoints, so it cannot change while the process is running.
   */
  private cache: Map<string, CurrencyEntity> | null = null;
  private loading: Promise<Map<string, CurrencyEntity>> | null = null;

  constructor(private readonly currenciesRepository: CurrenciesRepository) {}

  async findAll(dto: FindCurrenciesDto = {}): Promise<CurrencyEntity[]> {
    const all = [...(await this.getCache()).values()];

    let result = dto.includeInactive ? all : all.filter((c) => c.isActive);

    if (dto.popularOnly) {
      result = result.filter((c) => c.isPopular);
    }

    if (dto.search) {
      const needle = dto.search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(needle) ||
          c.name.toLowerCase().includes(needle) ||
          c.nameEs.toLowerCase().includes(needle),
      );
    }

    return result;
  }

  async findByCode(code: string): Promise<CurrencyEntity> {
    const currency = (await this.getCache()).get(this.normalize(code));
    if (!currency) {
      throw new NotFoundException(`La moneda "${code}" no existe en el catálogo ISO 4217`);
    }
    return currency;
  }

  /**
   * Validates a currency code coming from a payload. Throws 400 (not 404)
   * because from the caller's perspective this is an invalid field, not a
   * missing resource.
   */
  async assertExists(code: string): Promise<CurrencyEntity> {
    const normalized = this.normalize(code);
    const currency = (await this.getCache()).get(normalized);

    if (!currency || !currency.isActive) {
      throw new BadRequestException(
        `La moneda "${code}" no es válida. Debe ser un código ISO 4217 activo (ej: COP, USD, EUR).`,
      );
    }

    return currency;
  }

  /** Minor units for a code, defaulting to 2 for anything unknown. */
  async getDecimalDigits(code: string): Promise<number> {
    const currency = (await this.getCache()).get(this.normalize(code));
    return currency?.decimalDigits ?? 2;
  }

  private normalize(code: string): string {
    return code?.trim().toUpperCase();
  }

  private async getCache(): Promise<Map<string, CurrencyEntity>> {
    if (this.cache) return this.cache;

    // Collapse concurrent cold reads onto a single query. Cleared on failure
    // too, so a transient database error doesn't poison every later read.
    this.loading ??= this.currenciesRepository
      .findAll()
      .then((rows) => {
        this.cache = new Map(rows.map((c) => [c.code, c]));
        return this.cache;
      })
      .finally(() => {
        this.loading = null;
      });

    return this.loading;
  }
}
