import { Test, TestingModule } from '@nestjs/testing';
import { ProductionsService } from './productions.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProductionsRepository } from './productions.repository.js';
import { SupplyStockEntriesRepository } from '../supply-stock-entries/supply-stock-entries.repository.js';
import { SupplyStocksRepository } from '../supply-stocks/supply-stocks.repository.js';
import { Prisma, ProductionType, ProductionStatus, UnitOfMeasure } from '@prisma/client';
import { ProductionEntity } from './domain/production.entity.js';

describe('ProductionsService', () => {
  let service: ProductionsService;

  const mockPrisma = {
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    inventoryMovement: { deleteMany: jest.fn() },
    productStock: { update: jest.fn() },
    supplyMovement: { deleteMany: jest.fn() },
    productionSupplyUsage: { findMany: jest.fn(), deleteMany: jest.fn() },
    supplyStockEntry: { findUnique: jest.fn(), update: jest.fn() },
    production: { delete: jest.fn() },
  };

  const mockProductionsRepo = {
    findById: jest.fn(),
    delete: jest.fn(),
  };

  const mockEntriesRepo = {};
  const mockSupplyStocksRepo = {
    syncQuantityWithEntries: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProductionsRepository, useValue: mockProductionsRepo },
        { provide: SupplyStockEntriesRepository, useValue: mockEntriesRepo },
        { provide: SupplyStocksRepository, useValue: mockSupplyStocksRepo },
      ],
    }).compile();

    service = module.get<ProductionsService>(ProductionsService);
    jest.clearAllMocks();
  });

  describe('remove', () => {
    it('should delete a DRAFT production directly using repo delete', async () => {
      const mockProduction = new ProductionEntity({
        id: 'prod-1',
        organizationId: 'org-123',
        name: 'Lote borrador',
        productionDate: new Date(),
        type: ProductionType.SELLABLE,
        status: ProductionStatus.DRAFT,
        productId: 'product-123',
        quantityProduced: new Prisma.Decimal(10),
        unitOfMeasure: UnitOfMeasure.UNIT,
        totalCost: new Prisma.Decimal(5000),
        notes: null,
        performedByUserId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockProductionsRepo.findById.mockResolvedValueOnce(mockProduction);
      mockProductionsRepo.delete.mockResolvedValueOnce(mockProduction);

      const result = await service.remove('prod-1');

      expect(mockProductionsRepo.findById).toHaveBeenCalledWith('prod-1');
      expect(mockProductionsRepo.delete).toHaveBeenCalledWith('prod-1');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(result).toEqual(mockProduction);
    });

    it('should revert and delete a COMPLETED SELLABLE production', async () => {
      const mockProduction = new ProductionEntity({
        id: 'prod-2',
        organizationId: 'org-123',
        name: 'Lote completado vendible',
        productionDate: new Date(),
        type: ProductionType.SELLABLE,
        status: ProductionStatus.COMPLETED,
        productId: 'product-123',
        quantityProduced: new Prisma.Decimal(10),
        unitOfMeasure: UnitOfMeasure.UNIT,
        totalCost: new Prisma.Decimal(5000),
        notes: null,
        performedByUserId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockProductionsRepo.findById.mockResolvedValueOnce(mockProduction);

      // Usages mock
      const mockUsages = [
        {
          id: 'usage-1',
          productionId: 'prod-2',
          supplyId: 'supply-1',
          supplyStockEntryId: 'entry-1',
          quantityUsed: new Prisma.Decimal(5),
          unitCost: new Prisma.Decimal(100),
          totalCost: new Prisma.Decimal(500),
        },
      ];
      mockPrisma.productionSupplyUsage.findMany.mockResolvedValueOnce(mockUsages);
      mockPrisma.supplyStockEntry.findUnique.mockResolvedValueOnce({
        id: 'entry-1',
        supplyStockId: 's-stock-1',
      });

      const result = await service.remove('prod-2');

      // Product stock decrement
      expect(mockPrisma.inventoryMovement.deleteMany).toHaveBeenCalledWith({
        where: { productionId: 'prod-2' },
      });
      expect(mockPrisma.productStock.update).toHaveBeenCalledWith({
        where: {
          productId_location: {
            productId: 'product-123',
            location: 'Principal',
          },
        },
        data: {
          quantity: { decrement: new Prisma.Decimal(10) },
        },
      });

      // Supply movements revert
      expect(mockPrisma.supplyMovement.deleteMany).toHaveBeenCalledWith({
        where: { productionId: 'prod-2' },
      });

      // Restoring stock entries
      expect(mockPrisma.supplyStockEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: {
          remainingQuantity: { increment: new Prisma.Decimal(5) },
          isExhausted: false,
        },
      });

      // Sync supply stocks
      expect(mockSupplyStocksRepo.syncQuantityWithEntries).toHaveBeenCalledWith('s-stock-1', mockPrisma);

      // Delete usages & production
      expect(mockPrisma.productionSupplyUsage.deleteMany).toHaveBeenCalledWith({
        where: { productionId: 'prod-2' },
      });
      expect(mockPrisma.production.delete).toHaveBeenCalledWith({
        where: { id: 'prod-2' },
      });

      expect(result).toEqual(mockProduction);
    });

    it('should revert and delete a COMPLETED INTERMEDIATE production without touching product stock', async () => {
      const mockProduction = new ProductionEntity({
        id: 'prod-3',
        organizationId: 'org-123',
        name: 'Lote completado intermedio',
        productionDate: new Date(),
        type: ProductionType.INTERMEDIATE,
        status: ProductionStatus.COMPLETED,
        productId: null,
        quantityProduced: new Prisma.Decimal(10),
        unitOfMeasure: UnitOfMeasure.UNIT,
        totalCost: new Prisma.Decimal(5000),
        notes: null,
        performedByUserId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockProductionsRepo.findById.mockResolvedValueOnce(mockProduction);
      mockPrisma.productionSupplyUsage.findMany.mockResolvedValueOnce([]); // no usages for simple mock

      const result = await service.remove('prod-3');

      // Product stock should NOT be modified
      expect(mockPrisma.inventoryMovement.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.productStock.update).not.toHaveBeenCalled();

      // Supply movements revert
      expect(mockPrisma.supplyMovement.deleteMany).toHaveBeenCalledWith({
        where: { productionId: 'prod-3' },
      });

      // Delete production
      expect(mockPrisma.production.delete).toHaveBeenCalledWith({
        where: { id: 'prod-3' },
      });

      expect(result).toEqual(mockProduction);
    });
  });
});
