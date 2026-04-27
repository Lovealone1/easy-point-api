import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SupplyPurchasesRepository } from './supply-purchases.repository.js';
import { SupplyMovementsRepository } from '../supply-movements/supply-movements.repository.js';
import { SupplyStocksRepository } from '../supply-stocks/supply-stocks.repository.js';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service.js';
import { CreateSupplyPurchaseDto, CreateSupplyPurchaseItemDto } from './dto/create-supply-purchase.dto.js';
import { CompleteSupplyPurchaseDto } from './dto/complete-supply-purchase.dto.js';
import { AddItemsSupplyPurchaseDto } from './dto/add-items-supply-purchase.dto.js';
import { FindSupplyPurchasesDto } from './dto/find-supply-purchases.dto.js';
import { SupplyPurchaseEntity } from './domain/supply-purchase.entity.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { Prisma, PurchaseStatus, SupplyMovementType, TransactionType, OperationType } from '@prisma/client';

@Injectable()
export class SupplyPurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supplyPurchasesRepository: SupplyPurchasesRepository,
    private readonly supplyMovementsRepository: SupplyMovementsRepository,
    private readonly supplyStocksRepository: SupplyStocksRepository,
    private readonly financialTransactionsService: FinancialTransactionsService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Creates a supply purchase atomically:
   *  1. INSERT supply_purchases header
   *  2. INSERT supply_movements (bulk)
   *  3. UPDATE supply_stocks (quantity += item.quantity) per item
   *  4. If COMPLETED → createTransaction (DEBIT) + link transactionId
   *
   * If status = PENDING → steps 1-3 only. No financial transaction is recorded.
   */
  async create(userId: string, dto: CreateSupplyPurchaseDto): Promise<SupplyPurchaseEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    const status = dto.status ?? PurchaseStatus.COMPLETED;

    // Guard: bankAccountId is mandatory for COMPLETED purchases
    if (status === PurchaseStatus.COMPLETED && !dto.bankAccountId) {
      throw new BadRequestException(
        'bankAccountId is required when status is COMPLETED',
      );
    }

    // Calculate total from items
    const totalAmount = this.calcTotal(dto.items);

    return this.prisma.$transaction(async (tx) => {
      // 1 — Ensure stocks exist via Upsert
      const stockMap = await this.getOrCreateStocks(organizationId, dto.items, tx);

      // 2 — Insert the purchase header
      const purchase = await this.supplyPurchasesRepository.create(
        {
          organizationId,
          supplierId: dto.supplierId ?? null,
          totalAmount,
          status,
          notes: dto.notes ?? null,
          performedByUserId: userId,
        },
        tx,
      );

      // 3 — Bulk insert supply movements
      await this.supplyMovementsRepository.createMany(
        dto.items.map((item) => {
          const location = item.location || 'Principal';
          const stockId = stockMap.get(`${item.supplyId}_${location}`);
          return {
            organizationId,
            supplyId: item.supplyId,
            stockId: stockId!,
            quantity: new Prisma.Decimal(item.quantity),
            unitCost: item.unitCost != null ? new Prisma.Decimal(item.unitCost) : null,
            type: SupplyMovementType.PURCHASE,
            supplyPurchaseId: purchase.id,
            performedByUserId: userId,
          };
        }),
        tx,
      );

      // 4 — Increment supply stock quantities
      for (const item of dto.items) {
        const location = item.location || 'Principal';
        const stockId = stockMap.get(`${item.supplyId}_${location}`);
        await this.supplyStocksRepository.incrementQuantity(
          stockId!,
          new Prisma.Decimal(item.quantity),
          tx,
        );
      }

      // 5 — If COMPLETED: create financial transaction and link it
      if (status === PurchaseStatus.COMPLETED) {
        const transaction = await this.financialTransactionsService.createTransaction(
          {
            organizationId,
            bankAccountId: dto.bankAccountId!,
            type: TransactionType.DEBIT,
            amount: new Prisma.Decimal(totalAmount),
            operationType: OperationType.PURCHASE,
            referenceId: purchase.id,
            referenceType: 'SupplyPurchase',
            categoryId: dto.categoryId,
            paymentMethod: dto.paymentMethod,
            description: dto.notes ?? `Supply purchase ${purchase.id}`,
            performedByUserId: userId,
          },
          tx,
        );

        // Link the financial transaction to the purchase
        return this.supplyPurchasesRepository.update(
          purchase.id,
          { transactionId: transaction.id },
          tx,
        );
      }

      return purchase;
    });
  }

  // ─── Complete (PENDING → COMPLETED) ───────────────────────────────────────

  /**
   * Transitions a PENDING purchase to COMPLETED.
   * Creates the financial transaction (DEBIT) and links it — all in one tx.
   */
  async complete(
    userId: string,
    id: string,
    dto: CompleteSupplyPurchaseDto,
  ): Promise<SupplyPurchaseEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    return this.prisma.$transaction(async (tx) => {
      // 1 — Load and validate state
      const purchase = await this.supplyPurchasesRepository.findById(id, tx);
      if (!purchase) throw new NotFoundException(`SupplyPurchase with ID ${id} not found`);
      if (purchase.organizationId !== organizationId) {
        throw new NotFoundException(`SupplyPurchase with ID ${id} not found`);
      }
      if (purchase.status !== PurchaseStatus.PENDING) {
        throw new ConflictException(
          `Purchase is already ${purchase.status} and cannot be completed again`,
        );
      }

      // 2 — Create the financial transaction (DEBIT)
      const transaction = await this.financialTransactionsService.createTransaction(
        {
          organizationId,
          bankAccountId: dto.bankAccountId,
          type: TransactionType.DEBIT,
          amount: purchase.totalAmount,
          operationType: OperationType.PURCHASE,
          referenceId: purchase.id,
          referenceType: 'SupplyPurchase',
          categoryId: dto.categoryId,
          paymentMethod: dto.paymentMethod,
          description: dto.notes ?? `Completion of supply purchase ${purchase.id}`,
          performedByUserId: userId,
        },
        tx,
      );

      // 3 — Update purchase to COMPLETED + link transaction
      return this.supplyPurchasesRepository.update(
        purchase.id,
        {
          status: PurchaseStatus.COMPLETED,
          transactionId: transaction.id,
          notes: dto.notes ?? purchase.notes,
        },
        tx,
      );
    });
  }

  // ─── Add items to PENDING purchase ────────────────────────────────────────

  /**
   * Adds more supply lines to a PENDING purchase.
   * Updates SupplyMovements (bulk) + SupplyStocks + totalAmount — all in one tx.
   * COMPLETED purchases are immutable — throws ConflictException.
   */
  async addItems(
    userId: string,
    id: string,
    dto: AddItemsSupplyPurchaseDto,
  ): Promise<SupplyPurchaseEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    return this.prisma.$transaction(async (tx) => {
      // 1 — Load and validate state
      const purchase = await this.supplyPurchasesRepository.findById(id, tx);
      if (!purchase) throw new NotFoundException(`SupplyPurchase with ID ${id} not found`);
      if (purchase.organizationId !== organizationId) {
        throw new NotFoundException(`SupplyPurchase with ID ${id} not found`);
      }
      if (purchase.status !== PurchaseStatus.PENDING) {
        throw new ConflictException(
          `Only PENDING purchases can be modified. Current status: ${purchase.status}`,
        );
      }

      // 2 — Ensure stocks exist via Upsert
      const stockMap = await this.getOrCreateStocks(organizationId, dto.items, tx);

      // 3 — Calculate additional amount
      const additionalAmount = this.calcTotal(dto.items);
      const newTotal = purchase.totalAmount.plus(new Prisma.Decimal(additionalAmount));

      // 4 — Bulk insert new supply movements
      await this.supplyMovementsRepository.createMany(
        dto.items.map((item) => {
          const location = item.location || 'Principal';
          const stockId = stockMap.get(`${item.supplyId}_${location}`);
          return {
            organizationId,
            supplyId: item.supplyId,
            stockId: stockId!,
            quantity: new Prisma.Decimal(item.quantity),
            unitCost: item.unitCost != null ? new Prisma.Decimal(item.unitCost) : null,
            type: SupplyMovementType.PURCHASE,
            supplyPurchaseId: purchase.id,
            performedByUserId: userId,
          };
        }),
        tx,
      );

      // 5 — Increment supply stock quantities
      for (const item of dto.items) {
        const location = item.location || 'Principal';
        const stockId = stockMap.get(`${item.supplyId}_${location}`);
        await this.supplyStocksRepository.incrementQuantity(
          stockId!,
          new Prisma.Decimal(item.quantity),
          tx,
        );
      }

      // 6 — Update purchase totalAmount
      return this.supplyPurchasesRepository.update(
        purchase.id,
        { totalAmount: newTotal },
        tx,
      );
    });
  }

  // ─── Delete / Cancel ──────────────────────────────────────────────────────

  /**
   * Cancels or deletes a supply purchase atomically.
   * If PENDING: Decrements stock, deletes movements, and hard-deletes the purchase.
   * If COMPLETED: Decrements stock, deletes movements, credits the bank, and updates status to CANCELLED.
   */
  async remove(userId: string, id: string): Promise<void> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    await this.prisma.$transaction(async (tx) => {
      const purchase = await this.supplyPurchasesRepository.findById(id, tx);
      if (!purchase || purchase.organizationId !== organizationId) {
        throw new NotFoundException(`SupplyPurchase with ID ${id} not found`);
      }

      if (purchase.status === PurchaseStatus.CANCELLED) {
        throw new ConflictException('Purchase is already cancelled');
      }

      // 1 — Get all movements associated with this purchase
      const movements = await tx.supplyMovement.findMany({
        where: { supplyPurchaseId: purchase.id },
      });

      // 2 — Reverse stock quantities
      for (const mov of movements) {
        await this.supplyStocksRepository.incrementQuantity(
          mov.stockId,
          new Prisma.Decimal(mov.quantity).negated(), // Subtract
          tx,
        );
      }

      // 3 — Delete movements physically
      await tx.supplyMovement.deleteMany({
        where: { supplyPurchaseId: purchase.id },
      });

      // 4 — Handle Financials and Purchase Record based on status
      if (purchase.status === PurchaseStatus.PENDING) {
        // Hard delete the purchase
        await tx.supplyPurchase.delete({ where: { id: purchase.id } });
      } else if (purchase.status === PurchaseStatus.COMPLETED) {
        if (!purchase.transactionId) {
          throw new ConflictException('Completed purchase is missing a transaction ID');
        }

        // Get the original financial transaction to find the bankAccountId
        const originalTx = await tx.financialTransaction.findUnique({
          where: { id: purchase.transactionId },
        });

        if (!originalTx) {
          throw new ConflictException('Original financial transaction not found');
        }

        // Issue a CREDIT to refund the money
        await this.financialTransactionsService.createTransaction(
          {
            organizationId,
            bankAccountId: originalTx.bankAccountId,
            type: TransactionType.CREDIT,
            amount: purchase.totalAmount,
            operationType: OperationType.REFUND,
            referenceId: purchase.id,
            referenceType: 'SupplyPurchase',
            description: `Cancelación / Reembolso de compra ${purchase.id}`,
            performedByUserId: userId,
          },
          tx,
        );

        // Soft delete: update status to CANCELLED
        await this.supplyPurchasesRepository.update(
          purchase.id,
          { status: PurchaseStatus.CANCELLED },
          tx,
        );
      }
    });
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  async findAll(query: FindSupplyPurchasesDto): Promise<PageDto<SupplyPurchaseEntity>> {
    const where: Prisma.SupplyPurchaseWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;

    const [items, count] = await this.supplyPurchasesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<SupplyPurchaseEntity> {
    const organizationId = getTenantId();
    const record = await this.supplyPurchasesRepository.findById(id);
    if (!record) throw new NotFoundException(`SupplyPurchase with ID ${id} not found`);
    if (organizationId && record.organizationId !== organizationId) {
      throw new NotFoundException(`SupplyPurchase with ID ${id} not found`);
    }
    return record;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Calculates the purchase total from item lines.
   * Uses unitCost * quantity when unitCost is provided; otherwise 0 contribution.
   */
  private calcTotal(items: CreateSupplyPurchaseItemDto[]): Prisma.Decimal {
    return items.reduce((acc, item) => {
      if (item.unitCost != null) {
        const lineTotal = new Prisma.Decimal(item.unitCost).times(new Prisma.Decimal(item.quantity));
        return acc.plus(lineTotal);
      }
      return acc;
    }, new Prisma.Decimal(0));
  }

  /**
   * Ensures the supply exists, and upserts the Stock records.
   * Returns a map of `supplyId_location` -> `stockId`.
   */
  private async getOrCreateStocks(
    organizationId: string,
    items: CreateSupplyPurchaseItemDto[],
    tx: Prisma.TransactionClient,
  ): Promise<Map<string, string>> {
    // 1. Verify all supplyIds exist and belong to the organization
    const supplyIds = [...new Set(items.map((i) => i.supplyId))];
    const suppliesCount = await tx.supply.count({
      where: {
        id: { in: supplyIds },
        organizationId,
      },
    });

    if (suppliesCount !== supplyIds.length) {
      throw new BadRequestException(
        'One or more supply IDs are invalid or do not belong to this organization',
      );
    }

    // 2. Upsert stocks and build the mapping
    const stockMap = new Map<string, string>();
    for (const item of items) {
      const location = item.location || 'Principal';
      const key = `${item.supplyId}_${location}`;
      if (stockMap.has(key)) continue;

      const stock = await this.supplyStocksRepository.upsert(
        {
          supplyId: item.supplyId,
          location,
          organizationId,
        },
        tx,
      );
      stockMap.set(key, stock.id);
    }

    return stockMap;
  }
}
