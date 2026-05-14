import { Test, TestingModule } from '@nestjs/testing';
jest.mock('nanoid', () => ({ customAlphabet: () => jest.fn() }));
import { SalesService } from './sales.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SalesRepository } from './sales.repository.js';
import { InventoryMovementsRepository } from '../inventory-movements/inventory-movements.repository.js';
import { ProductStocksRepository } from '../product-stocks/product-stocks.repository.js';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service.js';
import { UtilitiesService } from '../utilities/utilities.service.js';
import { Prisma, SaleStatus, TransactionType, PaymentMethod } from '@prisma/client';
import { BadRequestException, NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { SaleEntity } from './domain/sale.entity.js';

// Mocks
jest.mock('../../common/context/tenant.context.js', () => ({
  getTenantId: jest.fn(),
}));
const { getTenantId } = jest.requireMock('../../common/context/tenant.context.js');

describe('SalesService', () => {
  let service: SalesService;

  const mockPrisma = {
    $transaction: jest.fn(async (cb) => {
      return cb(mockPrisma);
    }),
    product: { count: jest.fn() },
    productStock: { findUnique: jest.fn(), findMany: jest.fn() },
    inventoryMovement: { findMany: jest.fn(), deleteMany: jest.fn() },
    sale: { delete: jest.fn() },
    financialTransaction: { findUnique: jest.fn() },
  };

  const mockSalesRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    findManyWithCount: jest.fn(),
  };

  const mockInventoryMovementsRepo = {
    createMany: jest.fn(),
  };

  const mockProductStocksRepo = {
    incrementQuantity: jest.fn(),
  };

  const mockFinancialTxService = {
    createTransaction: jest.fn(),
  };

  const mockUtilitiesService = {
    computeAndPersist: jest.fn(),
    deleteForSale: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SalesRepository, useValue: mockSalesRepo },
        { provide: InventoryMovementsRepository, useValue: mockInventoryMovementsRepo },
        { provide: ProductStocksRepository, useValue: mockProductStocksRepo },
        { provide: FinancialTransactionsService, useValue: mockFinancialTxService },
        { provide: UtilitiesService, useValue: mockUtilitiesService },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
    jest.clearAllMocks();
  });

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';

  describe('create', () => {
    it('should throw BadRequestException if organizationId is missing', async () => {
      getTenantId.mockReturnValue(null);
      await expect(service.create(mockUserId, { items: [] })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if status is COMPLETED but missing bank details', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      await expect(service.create(mockUserId, {
        status: SaleStatus.COMPLETED,
        items: [],
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if products are invalid for organization', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      mockPrisma.product.count.mockResolvedValueOnce(0); // 0 products found but 1 requested

      await expect(service.create(mockUserId, {
        status: SaleStatus.PENDING,
        items: [{ productId: 'prod-1', quantity: 1, unitPrice: 10 }],
      })).rejects.toThrow(BadRequestException);
    });

    it('should successfully create a COMPLETED sale', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      
      // Mocks for resolveStocks
      mockPrisma.product.count.mockResolvedValueOnce(1);
      mockPrisma.productStock.findUnique.mockResolvedValueOnce({ id: 'stock-1' });
      
      // Mocks for validateSufficientStock
      mockPrisma.productStock.findMany.mockResolvedValueOnce([
        { id: 'stock-1', quantity: new Prisma.Decimal(10) }
      ]);

      const createdSale = new SaleEntity({
        id: 'sale-1', organizationId: mockOrgId, clientId: null,
        subtotalAmount: null, discountAmount: null, totalAmount: new Prisma.Decimal(50),
        transactionId: null, status: SaleStatus.COMPLETED, notes: null,
        performedByUserId: mockUserId, createdAt: new Date(), updatedAt: new Date(),
      });

      mockSalesRepo.create.mockResolvedValueOnce(createdSale);
      mockFinancialTxService.createTransaction.mockResolvedValueOnce({ id: 'txn-1' });
      mockSalesRepo.update.mockResolvedValueOnce({ ...createdSale, transactionId: 'txn-1' });

      const dto = {
        status: SaleStatus.COMPLETED,
        bankAccountId: 'bank-1',
        paymentMethod: PaymentMethod.CASH,
        items: [{ productId: 'prod-1', quantity: 5, unitPrice: 10 }],
      };

      const result = await service.create(mockUserId, dto);

      expect(result.transactionId).toBe('txn-1');
      expect(mockSalesRepo.create).toHaveBeenCalled();
      expect(mockInventoryMovementsRepo.createMany).toHaveBeenCalled();
      expect(mockProductStocksRepo.incrementQuantity).toHaveBeenCalled();
      expect(mockFinancialTxService.createTransaction).toHaveBeenCalled();
      expect(mockUtilitiesService.computeAndPersist).toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('should throw NotFoundException if sale not found', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      mockSalesRepo.findById.mockResolvedValueOnce(null);

      await expect(service.complete(mockUserId, 'sale-1', { bankAccountId: 'bank-1', paymentMethod: PaymentMethod.CASH }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if sale is already COMPLETED', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      const existingSale = { id: 'sale-1', organizationId: mockOrgId, status: SaleStatus.COMPLETED };
      mockSalesRepo.findById.mockResolvedValueOnce(existingSale);

      await expect(service.complete(mockUserId, 'sale-1', { bankAccountId: 'bank-1', paymentMethod: PaymentMethod.CASH }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should cancel a COMPLETED sale and create a DEBIT refund transaction', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      
      const existingSale = { 
        id: 'sale-1', organizationId: mockOrgId, status: SaleStatus.COMPLETED, 
        transactionId: 'txn-old', totalAmount: new Prisma.Decimal(100) 
      };
      
      mockSalesRepo.findById.mockResolvedValueOnce(existingSale);
      mockPrisma.inventoryMovement.findMany.mockResolvedValueOnce([
        { stockId: 'stock-1', quantity: new Prisma.Decimal(5) }
      ]);
      mockPrisma.financialTransaction.findUnique.mockResolvedValueOnce({ bankAccountId: 'bank-1' });

      await service.remove(mockUserId, 'sale-1');

      // Restores stock
      expect(mockProductStocksRepo.incrementQuantity).toHaveBeenCalledWith('stock-1', new Prisma.Decimal(5), mockPrisma);
      
      // Creates refund
      expect(mockFinancialTxService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: TransactionType.DEBIT, amount: new Prisma.Decimal(100) }),
        mockPrisma
      );

      // Marks cancelled
      expect(mockSalesRepo.update).toHaveBeenCalledWith('sale-1', { status: SaleStatus.CANCELLED }, mockPrisma);
    });
  });
});
