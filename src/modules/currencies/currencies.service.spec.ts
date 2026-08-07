import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CurrenciesService } from './currencies.service.js';
import { CurrenciesRepository } from './currencies.repository.js';
import { CurrencyEntity } from './domain/currency.entity.js';

function currency(overrides: Partial<ConstructorParameters<typeof CurrencyEntity>[0]> = {}) {
  return new CurrencyEntity({
    code: 'COP',
    numericCode: '170',
    name: 'Colombian Peso',
    nameEs: 'Peso colombiano',
    symbol: '$',
    decimalDigits: 2,
    isActive: true,
    isPopular: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('CurrenciesService', () => {
  let service: CurrenciesService;
  let repository: { findAll: jest.Mock };

  const catalog = [
    currency(),
    currency({ code: 'USD', name: 'US Dollar', nameEs: 'Dólar estadounidense', sortOrder: 1 }),
    currency({ code: 'JPY', name: 'Yen', nameEs: 'Yen japonés', isPopular: false, sortOrder: 100, decimalDigits: 0 }),
    currency({ code: 'XXX', name: 'Retired', nameEs: 'Retirada', isPopular: false, isActive: false, sortOrder: 100 }),
  ];

  beforeEach(async () => {
    repository = { findAll: jest.fn().mockResolvedValue(catalog) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CurrenciesService, { provide: CurrenciesRepository, useValue: repository }],
    }).compile();

    service = module.get(CurrenciesService);
  });

  describe('findAll', () => {
    it('excludes inactive currencies by default', async () => {
      const result = await service.findAll();
      expect(result.map((c) => c.code)).toEqual(['COP', 'USD', 'JPY']);
    });

    it('includes inactive currencies on request', async () => {
      const result = await service.findAll({ includeInactive: true });
      expect(result.map((c) => c.code)).toContain('XXX');
    });

    it('narrows to popular currencies', async () => {
      const result = await service.findAll({ popularOnly: true });
      expect(result.map((c) => c.code)).toEqual(['COP', 'USD']);
    });

    it('searches by code, English name and Spanish name', async () => {
      expect((await service.findAll({ search: 'jpy' })).map((c) => c.code)).toEqual(['JPY']);
      expect((await service.findAll({ search: 'Dollar' })).map((c) => c.code)).toEqual(['USD']);
      expect((await service.findAll({ search: 'japonés' })).map((c) => c.code)).toEqual(['JPY']);
    });
  });

  describe('caching', () => {
    it('queries the database only once across many reads', async () => {
      await service.findAll();
      await service.findByCode('USD');
      await service.assertExists('COP');

      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });

    it('collapses concurrent cold reads onto a single query', async () => {
      await Promise.all([service.findAll(), service.findAll(), service.findAll()]);
      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });

    it('retries after a failed load rather than caching the failure', async () => {
      repository.findAll.mockRejectedValueOnce(new Error('database down'));

      await expect(service.findAll()).rejects.toThrow('database down');
      await expect(service.findAll()).resolves.toHaveLength(3);
    });
  });

  describe('assertExists', () => {
    it('accepts a valid code regardless of case or padding', async () => {
      const result = await service.assertExists(' cop ');
      expect(result.code).toBe('COP');
    });

    it('rejects an unknown code with a 400', async () => {
      await expect(service.assertExists('ZZZ')).rejects.toThrow(BadRequestException);
    });

    it('rejects an inactive code', async () => {
      await expect(service.assertExists('XXX')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByCode', () => {
    it('throws 404 for an unknown code', async () => {
      await expect(service.findByCode('ZZZ')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDecimalDigits', () => {
    it('returns the ISO minor unit', async () => {
      expect(await service.getDecimalDigits('JPY')).toBe(0);
      expect(await service.getDecimalDigits('COP')).toBe(2);
    });

    it('defaults to 2 for an unknown code', async () => {
      expect(await service.getDecimalDigits('ZZZ')).toBe(2);
    });
  });
});
