import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FinancialTransactionsRepository } from './financial-transactions.repository.js';
import { BankAccountsRepository } from '../bank-accounts/bank-accounts.repository.js';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto.js';
import { FindFinancialTransactionsDto } from './dto/find-financial-transactions.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { FinancialTransactionEntity } from './domain/financial-transaction.entity.js';
import {
  Prisma,
  TransactionType,
  OperationType,
  PaymentMethod,
  BankAccountStatus,
} from '@prisma/client';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

// ─── Internal interface ────────────────────────────────────────────────────────

export interface CreateTransactionParams {
  organizationId: string;
  bankAccountId: string;
  type: TransactionType;
  amount: Prisma.Decimal;
  operationType: OperationType;
  referenceId?: string;
  referenceType?: string;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  description?: string;
  metadata?: Record<string, unknown>;
  performedByUserId?: string;
}

// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class FinancialTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialTransactionsRepository: FinancialTransactionsRepository,
    private readonly bankAccountsRepository: BankAccountsRepository,
  ) {}

  // ─── Public CRUD endpoints ─────────────────────────────────────────────────

  async create(dto: CreateFinancialTransactionDto): Promise<FinancialTransactionEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    return this.createTransaction({
      organizationId,
      bankAccountId: dto.bankAccountId,
      type: dto.type,
      amount: new Prisma.Decimal(dto.amount),
      operationType: dto.operationType,
      paymentMethod: dto.paymentMethod,
      categoryId: dto.categoryId,
      description: dto.description,
    });
  }

  async findAll(query: FindFinancialTransactionsDto): Promise<PageDto<FinancialTransactionEntity>> {
    const where: Prisma.FinancialTransactionWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.bankAccountId) where.bankAccountId = query.bankAccountId;
    if (query.type) where.type = query.type;
    if (query.operationType) where.operationType = query.operationType;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.categoryId) where.categoryId = query.categoryId;

    const [items, count] = await this.financialTransactionsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<FinancialTransactionEntity> {
    const record = await this.financialTransactionsRepository.findById(id);
    if (!record) throw new NotFoundException(`Financial transaction with ID ${id} not found`);
    return record;
  }

  // ─── Core internal method (used by Fase 3 orchestrators) ──────────────────

  /**
   * Atomically records a financial transaction and updates the bank account
   * balance using Optimistic Concurrency Control (OCC via `version` field).
   *
   * @param params       Transaction details.
   * @param externalTx   Optional Prisma TransactionClient. When provided, this
   *                     operation joins the caller's outer atomic block instead
   *                     of creating its own. Use this when the caller (e.g.
   *                     SupplyPurchaseService) needs inventory + financial
   *                     records to be committed or rolled back together.
   */
  async createTransaction(
    params: CreateTransactionParams,
    externalTx?: Prisma.TransactionClient,
  ): Promise<FinancialTransactionEntity> {
    const execute = async (tx: Prisma.TransactionClient): Promise<FinancialTransactionEntity> => {
      // 1 — Load bank account inside the transaction
      const account = await this.bankAccountsRepository.findById(params.bankAccountId, tx);
      if (!account) {
        throw new NotFoundException(`Bank account with ID ${params.bankAccountId} not found`);
      }

      // 2 — Guard: account must be ACTIVE
      if (account.status !== BankAccountStatus.ACTIVE) {
        throw new UnprocessableEntityException(
          `Bank account "${account.name}" is ${account.status} and cannot receive transactions`,
        );
      }

      // 3 — Apply business logic on the domain entity
      const balanceBefore = account.balance;
      const versionBefore = account.version; // capture BEFORE mutation (entity increments it)
      if (params.type === TransactionType.CREDIT) {
        account.increaseBalance(params.amount);
      } else {
        account.decreaseBalance(params.amount); // throws if insufficient funds
      }
      const balanceAfter = account.balance;

      // 4 — Persist balance update with OCC check (WHERE version = versionBefore)
      try {
        await this.bankAccountsRepository.updateWithVersion(
          account.id,
          versionBefore,
          { balance: balanceAfter },
          tx,
        );
      } catch (error: any) {
        // Prisma P2025 = record not found → version mismatch → concurrent update
        if (error?.code === 'P2025') {
          throw new ConflictException(
            'Concurrent balance update detected. Please retry the operation.',
          );
        }
        throw error;
      }

      // 5 — Generate unique transaction number
      const today = new Date();
      const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
      const transactionNumber = `TXN-${datePart}-${nanoid()}`;

      // 6 — Insert the immutable transaction record
      return this.financialTransactionsRepository.create(
        {
          organizationId: params.organizationId,
          bankAccountId: params.bankAccountId,
          transactionNumber,
          type: params.type,
          amount: params.amount,
          balanceBefore,
          balanceAfter,
          operationType: params.operationType,
          referenceId: params.referenceId ?? null,
          referenceType: params.referenceType ?? null,
          categoryId: params.categoryId ?? null,
          paymentMethod: params.paymentMethod ?? null,
          description: params.description ?? null,
          metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : undefined,
          performedByUserId: params.performedByUserId ?? null,
        },
        tx,
      );
    };

    // If the caller already opened a transaction, join it; otherwise open our own.
    if (externalTx) {
      return execute(externalTx);
    }

    return this.prisma.$transaction(execute);
  }
}
