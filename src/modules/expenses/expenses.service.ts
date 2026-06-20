import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ExpensesRepository } from './expenses.repository.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { UpdateExpenseDto } from './dto/update-expense.dto.js';
import { FindExpensesDto } from './dto/find-expenses.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { ExpenseEntity } from './domain/expense.entity.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service.js';
import { Prisma, TransactionType, OperationType } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expensesRepository: ExpensesRepository,
    private readonly financialTransactionsService: FinancialTransactionsService,
  ) {}

  async create(userId: string, createDto: CreateExpenseDto): Promise<ExpenseEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Validar la categoría de gasto
      const category = await tx.expenseCategory.findUnique({
        where: { id: createDto.categoryId },
      });
      if (!category || category.organizationId !== organizationId) {
        throw new NotFoundException(`ExpenseCategory with ID ${createDto.categoryId} not found`);
      }
      if (!category.isActive) {
        throw new BadRequestException('Expense category is inactive');
      }

      // 2. Validar la cuenta bancaria
      const bankAccount = await tx.bankAccount.findUnique({
        where: { id: createDto.bankAccountId },
      });
      if (!bankAccount || bankAccount.organizationId !== organizationId) {
        throw new NotFoundException(`BankAccount with ID ${createDto.bankAccountId} not found`);
      }

      // 3. Crear transacción financiera (debitará del banco y validará fondos insuficientes)
      const transaction = await this.financialTransactionsService.createTransaction(
        {
          organizationId,
          bankAccountId: createDto.bankAccountId,
          type: TransactionType.DEBIT,
          amount: new Prisma.Decimal(createDto.amount),
          operationType: OperationType.EXPENSE,
          description: createDto.description ?? `Gasto de categoría: ${category.name}`,
          performedByUserId: userId,
          createdAt: createDto.createdAt ? new Date(createDto.createdAt) : undefined,
        },
        tx,
      );

      // 4. Crear el registro del gasto en base de datos
      return this.expensesRepository.create(
        {
          organizationId,
          categoryId: createDto.categoryId,
          bankAccountId: createDto.bankAccountId,
          amount: new Prisma.Decimal(createDto.amount),
          description: createDto.description ?? null,
          transactionId: transaction.id,
          createdAt: createDto.createdAt ? new Date(createDto.createdAt) : undefined,
        },
        tx,
      );
    });
  }

  async findAll(query: FindExpensesDto): Promise<PageDto<ExpenseEntity>> {
    const where: Prisma.ExpenseWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.bankAccountId) where.bankAccountId = query.bankAccountId;
    if (query.description) {
      where.description = { contains: query.description, mode: 'insensitive' };
    }

    const [items, count] = await this.expensesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<ExpenseEntity> {
    const record = await this.expensesRepository.findById(id);
    const tenantId = getTenantId();
    if (!record || (tenantId && record.organizationId !== tenantId)) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }
    return record;
  }

  async update(id: string, updateDto: UpdateExpenseDto): Promise<ExpenseEntity> {
    const current = await this.findOne(id);

    // Si se pasa categoryId, verificar que exista y esté activa
    if (updateDto.categoryId && updateDto.categoryId !== current.categoryId) {
      const category = await this.prisma.expenseCategory.findUnique({
        where: { id: updateDto.categoryId },
      });
      if (!category || category.organizationId !== current.organizationId) {
        throw new NotFoundException(`ExpenseCategory with ID ${updateDto.categoryId} not found`);
      }
      if (!category.isActive) {
        throw new BadRequestException('Expense category is inactive');
      }
    }

    return this.expensesRepository.update(id, updateDto);
  }

  async remove(userId: string, id: string): Promise<ExpenseEntity> {
    const tenantId = getTenantId();
    if (!tenantId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    return this.prisma.$transaction(async (tx) => {
      const record = await this.expensesRepository.findById(id, tx);
      if (!record || record.organizationId !== tenantId) {
        throw new NotFoundException(`Expense with ID ${id} not found`);
      }

      // Reembolsar el saldo a la cuenta bancaria
      if (record.transactionId) {
        await this.financialTransactionsService.createTransaction(
          {
            organizationId: tenantId,
            bankAccountId: record.bankAccountId,
            type: TransactionType.CREDIT,
            amount: record.amount,
            operationType: OperationType.REFUND,
            referenceId: record.id,
            referenceType: 'Expense',
            description: `Reembolso por eliminación de gasto ${record.id}`,
            performedByUserId: userId,
          },
          tx,
        );
      }

      return this.expensesRepository.delete(id, tx);
    });
  }
}
