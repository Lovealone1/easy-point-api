import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SalesRepository } from './sales.repository.js';
import { InventoryMovementsRepository } from '../inventory-movements/inventory-movements.repository.js';
import { ProductStocksRepository } from '../product-stocks/product-stocks.repository.js';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service.js';
import { CreateSaleDto, CreateSaleItemDto } from './dto/create-sale.dto.js';
import { CompleteSaleDto } from './dto/complete-sale.dto.js';
import { AddItemsSaleDto } from './dto/add-items-sale.dto.js';
import { FindSalesDto } from './dto/find-sales.dto.js';
import { SaleEntity } from './domain/sale.entity.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { Prisma, SaleStatus, MovementType, TransactionType, OperationType } from '@prisma/client';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesRepository: SalesRepository,
    private readonly inventoryMovementsRepository: InventoryMovementsRepository,
    private readonly productStocksRepository: ProductStocksRepository,
    private readonly financialTransactionsService: FinancialTransactionsService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Creates a sale atomically:
   *  1. INSERT sale header
   *  2. INSERT inventory_movements (bulk, type = SALE)
   *  3. UPDATE product_stocks (quantity -= item.quantity) per item
   *  4. If COMPLETED → createTransaction (CREDIT) + link transactionId
   *
   * PENDING = registers stock decrements only (acts as quote/order). No financial credit.
   * COMPLETED = also credits the bank account.
   *
   * Key differences from ProductPurchases:
   *  - Transaction is CREDIT (money IN) not DEBIT (money OUT)
   *  - Stock is decremented, not incremented
   *  - paymentMethod is required when COMPLETED (for financial traceability)
   *  - clientId instead of supplierId
   *  - uses unitPrice (not unitCost)
   */
  async create(userId: string, dto: CreateSaleDto): Promise<SaleEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    const status = dto.status ?? SaleStatus.COMPLETED;

    if (status === SaleStatus.COMPLETED) {
      if (!dto.bankAccountId) {
        throw new BadRequestException('bankAccountId is required when status is COMPLETED');
      }
      if (!dto.paymentMethod) {
        throw new BadRequestException('paymentMethod is required when status is COMPLETED');
      }
    }

    const totalAmount = this.calcTotal(dto.items);

    return this.prisma.$transaction(async (tx) => {
      // 1 — Validate products and resolve stock records
      const stockMap = await this.resolveStocks(organizationId, dto.items, tx);

      // 2 — Guard: check no stock goes negative
      await this.validateSufficientStock(dto.items, stockMap, tx);

      // 3 — Insert sale header
      const sale = await this.salesRepository.create(
        {
          organizationId,
          clientId: dto.clientId ?? null,
          totalAmount,
          status,
          notes: dto.notes ?? null,
          performedByUserId: userId,
        },
        tx,
      );

      // 4 — Bulk insert inventory movements (type = SALE)
      await this.inventoryMovementsRepository.createMany(
        dto.items.map((item) => {
          const location = item.location || 'Principal';
          const stockId = stockMap.get(`${item.productId}_${location}`);
          return {
            organizationId,
            productId: item.productId,
            stockId: stockId!,
            quantity: new Prisma.Decimal(item.quantity),
            unitCost: new Prisma.Decimal(item.unitPrice),
            type: MovementType.SALE,
            saleId: sale.id,
            performedByUserId: userId,
          };
        }),
        tx,
      );

      // 5 — Decrement product stock quantities
      for (const item of dto.items) {
        const location = item.location || 'Principal';
        const stockId = stockMap.get(`${item.productId}_${location}`);
        await this.productStocksRepository.incrementQuantity(
          stockId!,
          new Prisma.Decimal(item.quantity).negated(), // negative = decrement
          tx,
        );
      }

      // 6 — If COMPLETED: create financial transaction (CREDIT) and link it
      if (status === SaleStatus.COMPLETED) {
        const transaction = await this.financialTransactionsService.createTransaction(
          {
            organizationId,
            bankAccountId: dto.bankAccountId!,
            type: TransactionType.CREDIT,
            amount: new Prisma.Decimal(totalAmount),
            operationType: OperationType.SALE,
            referenceId: sale.id,
            referenceType: 'Sale',
            categoryId: dto.categoryId,
            paymentMethod: dto.paymentMethod,
            description: dto.notes ?? `Sale ${sale.id}`,
            performedByUserId: userId,
          },
          tx,
        );

        return this.salesRepository.update(sale.id, { transactionId: transaction.id }, tx);
      }

      return sale;
    });
  }

  // ─── Complete (PENDING → COMPLETED) ───────────────────────────────────────

  async complete(userId: string, id: string, dto: CompleteSaleDto): Promise<SaleEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    return this.prisma.$transaction(async (tx) => {
      const sale = await this.salesRepository.findById(id, tx);
      if (!sale) throw new NotFoundException(`Sale with ID ${id} not found`);
      if (sale.organizationId !== organizationId) {
        throw new NotFoundException(`Sale with ID ${id} not found`);
      }
      if (sale.status !== SaleStatus.PENDING) {
        throw new ConflictException(
          `Sale is already ${sale.status} and cannot be completed again`,
        );
      }

      const transaction = await this.financialTransactionsService.createTransaction(
        {
          organizationId,
          bankAccountId: dto.bankAccountId,
          type: TransactionType.CREDIT,
          amount: sale.totalAmount,
          operationType: OperationType.SALE,
          referenceId: sale.id,
          referenceType: 'Sale',
          categoryId: dto.categoryId,
          paymentMethod: dto.paymentMethod,
          description: dto.notes ?? `Completion of sale ${sale.id}`,
          performedByUserId: userId,
        },
        tx,
      );

      return this.salesRepository.update(
        sale.id,
        {
          status: SaleStatus.COMPLETED,
          transactionId: transaction.id,
          notes: dto.notes ?? sale.notes,
        },
        tx,
      );
    });
  }

  // ─── Add items to PENDING sale ─────────────────────────────────────────────

  async addItems(userId: string, id: string, dto: AddItemsSaleDto): Promise<SaleEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    return this.prisma.$transaction(async (tx) => {
      const sale = await this.salesRepository.findById(id, tx);
      if (!sale) throw new NotFoundException(`Sale with ID ${id} not found`);
      if (sale.organizationId !== organizationId) {
        throw new NotFoundException(`Sale with ID ${id} not found`);
      }
      if (sale.status !== SaleStatus.PENDING) {
        throw new ConflictException(
          `Only PENDING sales can be modified. Current status: ${sale.status}`,
        );
      }

      const stockMap = await this.resolveStocks(organizationId, dto.items, tx);
      await this.validateSufficientStock(dto.items, stockMap, tx);

      const additionalAmount = this.calcTotal(dto.items);
      const newTotal = sale.totalAmount.plus(new Prisma.Decimal(additionalAmount));

      await this.inventoryMovementsRepository.createMany(
        dto.items.map((item) => {
          const location = item.location || 'Principal';
          const stockId = stockMap.get(`${item.productId}_${location}`);
          return {
            organizationId,
            productId: item.productId,
            stockId: stockId!,
            quantity: new Prisma.Decimal(item.quantity),
            unitCost: new Prisma.Decimal(item.unitPrice),
            type: MovementType.SALE,
            saleId: sale.id,
            performedByUserId: userId,
          };
        }),
        tx,
      );

      for (const item of dto.items) {
        const location = item.location || 'Principal';
        const stockId = stockMap.get(`${item.productId}_${location}`);
        await this.productStocksRepository.incrementQuantity(
          stockId!,
          new Prisma.Decimal(item.quantity).negated(),
          tx,
        );
      }

      return this.salesRepository.update(sale.id, { totalAmount: newTotal }, tx);
    });
  }

  // ─── Delete / Cancel ──────────────────────────────────────────────────────

  /**
   * Cancels or deletes a sale atomically.
   * PENDING → restores stock, deletes movements, hard-deletes the sale.
   * COMPLETED → restores stock, deletes movements, issues DEBIT refund (reversal), marks CANCELLED.
   */
  async remove(userId: string, id: string): Promise<void> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    await this.prisma.$transaction(async (tx) => {
      const sale = await this.salesRepository.findById(id, tx);
      if (!sale || sale.organizationId !== organizationId) {
        throw new NotFoundException(`Sale with ID ${id} not found`);
      }

      if (sale.status === SaleStatus.CANCELLED) {
        throw new ConflictException('Sale is already cancelled');
      }

      // 1 — Load movements
      const movements = await tx.inventoryMovement.findMany({
        where: { saleId: sale.id },
      });

      // 2 — Restore stock quantities (add back what was sold)
      for (const mov of movements) {
        await this.productStocksRepository.incrementQuantity(
          mov.stockId,
          new Prisma.Decimal(mov.quantity), // positive = restore
          tx,
        );
      }

      // 3 — Delete movements physically
      await tx.inventoryMovement.deleteMany({ where: { saleId: sale.id } });

      // 4 — Handle financials based on status
      if (sale.status === SaleStatus.PENDING) {
        await tx.sale.delete({ where: { id: sale.id } });
      } else if (sale.status === SaleStatus.COMPLETED) {
        if (!sale.transactionId) {
          throw new ConflictException('Completed sale is missing a transaction ID');
        }

        const originalTx = await tx.financialTransaction.findUnique({
          where: { id: sale.transactionId },
        });

        if (!originalTx) {
          throw new ConflictException('Original financial transaction not found');
        }

        // Reverse: DEBIT to cancel the CREDIT that was applied
        await this.financialTransactionsService.createTransaction(
          {
            organizationId,
            bankAccountId: originalTx.bankAccountId,
            type: TransactionType.DEBIT,
            amount: sale.totalAmount,
            operationType: OperationType.REFUND,
            referenceId: sale.id,
            referenceType: 'Sale',
            description: `Cancelación / Reverso de venta ${sale.id}`,
            performedByUserId: userId,
          },
          tx,
        );

        await this.salesRepository.update(sale.id, { status: SaleStatus.CANCELLED }, tx);
      }
    });
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  async findAll(query: FindSalesDto): Promise<PageDto<SaleEntity>> {
    const where: Prisma.SaleWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.clientId) where.clientId = query.clientId;
    if (query.status) where.status = query.status;

    const [items, count] = await this.salesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<SaleEntity> {
    const organizationId = getTenantId();
    const record = await this.salesRepository.findById(id);
    if (!record) throw new NotFoundException(`Sale with ID ${id} not found`);
    if (organizationId && record.organizationId !== organizationId) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }
    return record;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Calculates sale total from unitPrice * quantity per item. */
  private calcTotal(items: CreateSaleItemDto[]): Prisma.Decimal {
    return items.reduce((acc, item) => {
      const lineTotal = new Prisma.Decimal(item.unitPrice).times(new Prisma.Decimal(item.quantity));
      return acc.plus(lineTotal);
    }, new Prisma.Decimal(0));
  }

  /**
   * Validates products belong to org, then resolves existing stock records.
   * For sales, stock must already EXIST — we do NOT upsert/create stock on sale.
   * Returns a map of `productId_location` -> `stockId`.
   */
  private async resolveStocks(
    organizationId: string,
    items: CreateSaleItemDto[],
    tx: Prisma.TransactionClient,
  ): Promise<Map<string, string>> {
    const productIds = [...new Set(items.map((i) => i.productId))];

    const productsCount = await tx.product.count({
      where: { id: { in: productIds }, organizationId },
    });

    if (productsCount !== productIds.length) {
      throw new BadRequestException(
        'One or more product IDs are invalid or do not belong to this organization',
      );
    }

    const stockMap = new Map<string, string>();
    for (const item of items) {
      const location = item.location || 'Principal';
      const key = `${item.productId}_${location}`;
      if (stockMap.has(key)) continue;

      const stock = await tx.productStock.findUnique({
        where: {
          productId_location: { productId: item.productId, location },
        },
      });

      if (!stock) {
        throw new UnprocessableEntityException(
          `No stock record found for product ${item.productId} at location "${location}". ` +
          'Please create a stock record or register a product purchase first.',
        );
      }

      stockMap.set(key, stock.id);
    }

    return stockMap;
  }

  /**
   * Verifies that no stock record would go negative after this sale.
   * Queries each stock's current quantity and compares it against the
   * total quantity being sold for that product + location.
   */
  private async validateSufficientStock(
    items: CreateSaleItemDto[],
    stockMap: Map<string, string>,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    // Aggregate total quantity per stock (same product/location can appear multiple times)
    const totalByStock = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      const location = item.location || 'Principal';
      const stockId = stockMap.get(`${item.productId}_${location}`)!;
      const current = totalByStock.get(stockId) ?? new Prisma.Decimal(0);
      totalByStock.set(stockId, current.plus(new Prisma.Decimal(item.quantity)));
    }

    const stockIds = [...totalByStock.keys()];
    const stocks = await tx.productStock.findMany({
      where: { id: { in: stockIds } },
      select: { id: true, quantity: true },
    });

    for (const stock of stocks) {
      const required = totalByStock.get(stock.id)!;
      if (stock.quantity.lessThan(required)) {
        throw new UnprocessableEntityException(
          `Insufficient stock for stock record ${stock.id}. ` +
          `Available: ${stock.quantity}, Required: ${required}`,
        );
      }
    }
  }
}
