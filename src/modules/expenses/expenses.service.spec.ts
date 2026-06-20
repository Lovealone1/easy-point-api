import { Test, TestingModule } from '@nestjs/testing';
jest.mock('nanoid', () => ({ customAlphabet: () => jest.fn() }));
jest.mock('../../common/context/tenant.context.js', () => ({
  getTenantId: jest.fn(),
}));
const { getTenantId } = jest.requireMock('../../common/context/tenant.context.js');

import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExpensesService } from './expenses.service.js';
import { ExpensesRepository } from './expenses.repository.js';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ExpenseEntity } from './domain/expense.entity.js';
import { Prisma, TransactionType, OperationType } from '@prisma/client';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let repository: jest.Mocked<ExpensesRepository>;
  let financialTransactionsService: jest.Mocked<FinancialTransactionsService>;
  let prisma: jest.Mocked<PrismaService>;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';

  const mockExpenseRaw = {
    id: 'expense-123',
    organizationId: mockOrgId,
    categoryId: 'cat-123',
    bankAccountId: 'bank-123',
    amount: new Prisma.Decimal('150.50'),
    description: 'Dinner with client',
    transactionId: 'tx-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExpenseEntity = ExpenseEntity.fromPrisma(mockExpenseRaw);

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findManyWithCount: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockFinancialTransactionsService = {
      createTransaction: jest.fn(),
    };

    const mockPrisma = {
      $transaction: jest.fn((cb) => cb(mockPrisma)),
      expenseCategory: {
        findUnique: jest.fn(),
      },
      bankAccount: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: ExpensesRepository,
          useValue: mockRepository,
        },
        {
          provide: FinancialTransactionsService,
          useValue: mockFinancialTransactionsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    repository = module.get(ExpensesRepository) as any;
    financialTransactionsService = module.get(FinancialTransactionsService) as any;
    prisma = module.get(PrismaService) as any;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException if organizationId header is missing', async () => {
      getTenantId.mockReturnValue(null);
      await expect(
        service.create(mockUserId, {
          categoryId: 'cat-123',
          bankAccountId: 'bank-123',
          amount: 150.5,
          description: 'Dinner',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create an expense and call createTransaction inside transaction', async () => {
      getTenantId.mockReturnValue(mockOrgId);

      (prisma.expenseCategory.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'cat-123',
        organizationId: mockOrgId,
        isActive: true,
        name: 'Comida',
      });

      (prisma.bankAccount.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'bank-123',
        organizationId: mockOrgId,
        isActive: true,
      });

      financialTransactionsService.createTransaction.mockResolvedValueOnce({
        id: 'tx-123',
      } as any);

      repository.create.mockResolvedValueOnce(mockExpenseEntity);

      const result = await service.create(mockUserId, {
        categoryId: 'cat-123',
        bankAccountId: 'bank-123',
        amount: 150.5,
        description: 'Dinner',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(mockExpenseEntity.id);
      expect(prisma.expenseCategory.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-123' },
      });
      expect(prisma.bankAccount.findUnique).toHaveBeenCalledWith({
        where: { id: 'bank-123' },
      });
      expect(financialTransactionsService.createTransaction).toHaveBeenCalledWith(
        {
          organizationId: mockOrgId,
          bankAccountId: 'bank-123',
          type: TransactionType.DEBIT,
          amount: new Prisma.Decimal('150.5'),
          operationType: OperationType.EXPENSE,
          description: 'Dinner',
          performedByUserId: mockUserId,
        },
        prisma,
      );
      expect(repository.create).toHaveBeenCalledWith(
        {
          organizationId: mockOrgId,
          categoryId: 'cat-123',
          bankAccountId: 'bank-123',
          amount: new Prisma.Decimal('150.5'),
          description: 'Dinner',
          transactionId: 'tx-123',
        },
        prisma,
      );
    });

    it('should throw NotFoundException if category does not exist', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      (prisma.expenseCategory.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.create(mockUserId, {
          categoryId: 'cat-123',
          bankAccountId: 'bank-123',
          amount: 150.5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if category is inactive', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      (prisma.expenseCategory.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'cat-123',
        organizationId: mockOrgId,
        isActive: false,
      });

      await expect(
        service.create(mockUserId, {
          categoryId: 'cat-123',
          bankAccountId: 'bank-123',
          amount: 150.5,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should refund the bank account balance and delete the expense', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      repository.findById.mockResolvedValueOnce(mockExpenseEntity);
      financialTransactionsService.createTransaction.mockResolvedValueOnce({
        id: 'tx-refund',
      } as any);
      repository.delete.mockResolvedValueOnce(mockExpenseEntity);

      const result = await service.remove(mockUserId, 'expense-123');

      expect(result).toBeDefined();
      expect(repository.findById).toHaveBeenCalledWith('expense-123', prisma);
      expect(financialTransactionsService.createTransaction).toHaveBeenCalledWith(
        {
          organizationId: mockOrgId,
          bankAccountId: 'bank-123',
          type: TransactionType.CREDIT,
          amount: mockExpenseEntity.amount,
          operationType: OperationType.REFUND,
          referenceId: 'expense-123',
          referenceType: 'Expense',
          description: 'Reembolso por eliminación de gasto expense-123',
          performedByUserId: mockUserId,
        },
        prisma,
      );
      expect(repository.delete).toHaveBeenCalledWith('expense-123', prisma);
    });
  });
});
