import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProductPurchasesRepository } from './product-purchases.repository.js';
import { InventoryMovementsRepository } from '../inventory-movements/inventory-movements.repository.js';
import { ProductStocksRepository } from '../product-stocks/product-stocks.repository.js';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service.js';
import { CreateProductPurchaseDto, CreateProductPurchaseItemDto } from './dto/create-product-purchase.dto.js';
import { CompleteProductPurchaseDto } from './dto/complete-product-purchase.dto.js';
import { AddItemsProductPurchaseDto } from './dto/add-items-product-purchase.dto.js';
import { FindProductPurchasesDto } from './dto/find-product-purchases.dto.js';
import { ProductPurchaseEntity } from './domain/product-purchase.entity.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { Prisma, PurchaseStatus, MovementType, TransactionType, OperationType } from '@prisma/client';

@Injectable()
export class ProductPurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productPurchasesRepository: ProductPurchasesRepository,
    private readonly inventoryMovementsRepository: InventoryMovementsRepository,
    private readonly productStocksRepository: ProductStocksRepository,
    private readonly financialTransactionsService: FinancialTransactionsService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Creates a product purchase atomically:
   *  1. INSERT product_purchases header
   *  2. INSERT inventory_movements (bulk)
   *  3. UPDATE product_stocks (quantity += item.quantity) per item
   *  4. If COMPLETED → createTransaction (DEBIT) + link transactionId
   *
   * If status = PENDING → steps 1-3 only. No financial transaction is recorded.
   */
  async create(userId: string, dto: CreateProductPurchaseDto): Promise<ProductPurchaseEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    const status = dto.status ?? PurchaseStatus.COMPLETED;

    if (status === PurchaseStatus.COMPLETED && !dto.bankAccountId) {
      throw new BadRequestException('bankAccountId is required when status is COMPLETED');
    }

    const totalAmount = this.calcTotal(dto.items);

    return this.prisma.$transaction(async (tx) => {
      // 1 — Validate products and upsert stock records
      const stockMap = await this.getOrCreateStocks(organizationId, dto.items, tx);

      // 2 — Insert the purchase header
      const purchase = await this.productPurchasesRepository.create(
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

      // 3 — Bulk insert inventory movements
      await this.inventoryMovementsRepository.createMany(
        dto.items.map((item) => {
          const location = item.location || 'Principal';
          const stockId = stockMap.get(`${item.productId}_${location}`);
          return {
            organizationId,
            productId: item.productId,
            stockId: stockId!,
            quantity: new Prisma.Decimal(item.quantity),
            unitCost: item.unitCost != null ? new Prisma.Decimal(item.unitCost) : null,
            type: MovementType.PURCHASE,
            productPurchaseId: purchase.id,
            performedByUserId: userId,
          };
        }),
        tx,
      );

      // 4 — Increment product stock quantities
      for (const item of dto.items) {
        const location = item.location || 'Principal';
        const stockId = stockMap.get(`${item.productId}_${location}`);
        await this.productStocksRepository.incrementQuantity(
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
            referenceType: 'ProductPurchase',
            categoryId: dto.categoryId,
            paymentMethod: dto.paymentMethod,
            description: dto.notes ?? `Product purchase ${purchase.id}`,
            performedByUserId: userId,
          },
          tx,
        );

        return this.productPurchasesRepository.update(
          purchase.id,
          { transactionId: transaction.id },
          tx,
        );
      }

      return purchase;
    });
  }

  // ─── Complete (PENDING → COMPLETED) ───────────────────────────────────────

  async complete(
    userId: string,
    id: string,
    dto: CompleteProductPurchaseDto,
  ): Promise<ProductPurchaseEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    return this.prisma.$transaction(async (tx) => {
      const purchase = await this.productPurchasesRepository.findById(id, tx);
      if (!purchase) throw new NotFoundException(`ProductPurchase with ID ${id} not found`);
      if (purchase.organizationId !== organizationId) {
        throw new NotFoundException(`ProductPurchase with ID ${id} not found`);
      }
      if (purchase.status !== PurchaseStatus.PENDING) {
        throw new ConflictException(
          `Purchase is already ${purchase.status} and cannot be completed again`,
        );
      }

      const transaction = await this.financialTransactionsService.createTransaction(
        {
          organizationId,
          bankAccountId: dto.bankAccountId,
          type: TransactionType.DEBIT,
          amount: purchase.totalAmount,
          operationType: OperationType.PURCHASE,
          referenceId: purchase.id,
          referenceType: 'ProductPurchase',
          categoryId: dto.categoryId,
          paymentMethod: dto.paymentMethod,
          description: dto.notes ?? `Completion of product purchase ${purchase.id}`,
          performedByUserId: userId,
        },
        tx,
      );

      return this.productPurchasesRepository.update(
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

  async addItems(
    userId: string,
    id: string,
    dto: AddItemsProductPurchaseDto,
  ): Promise<ProductPurchaseEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    return this.prisma.$transaction(async (tx) => {
      const purchase = await this.productPurchasesRepository.findById(id, tx);
      if (!purchase) throw new NotFoundException(`ProductPurchase with ID ${id} not found`);
      if (purchase.organizationId !== organizationId) {
        throw new NotFoundException(`ProductPurchase with ID ${id} not found`);
      }
      if (purchase.status !== PurchaseStatus.PENDING) {
        throw new ConflictException(
          `Only PENDING purchases can be modified. Current status: ${purchase.status}`,
        );
      }

      const stockMap = await this.getOrCreateStocks(organizationId, dto.items, tx);
      const additionalAmount = this.calcTotal(dto.items);
      const newTotal = purchase.totalAmount.plus(new Prisma.Decimal(additionalAmount));

      await this.inventoryMovementsRepository.createMany(
        dto.items.map((item) => {
          const location = item.location || 'Principal';
          const stockId = stockMap.get(`${item.productId}_${location}`);
          return {
            organizationId,
            productId: item.productId,
            stockId: stockId!,
            quantity: new Prisma.Decimal(item.quantity),
            unitCost: item.unitCost != null ? new Prisma.Decimal(item.unitCost) : null,
            type: MovementType.PURCHASE,
            productPurchaseId: purchase.id,
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
          new Prisma.Decimal(item.quantity),
          tx,
        );
      }

      return this.productPurchasesRepository.update(
        purchase.id,
        { totalAmount: newTotal },
        tx,
      );
    });
  }

  // ─── Delete / Cancel ──────────────────────────────────────────────────────

  /**
   * Cancels or deletes a product purchase atomically.
   * PENDING → reverses stock, deletes movements, hard-deletes the purchase.
   * COMPLETED → reverses stock, deletes movements, issues CREDIT refund, marks CANCELLED.
   */
  async remove(userId: string, id: string): Promise<void> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');

    await this.prisma.$transaction(async (tx) => {
      const purchase = await this.productPurchasesRepository.findById(id, tx);
      if (!purchase || purchase.organizationId !== organizationId) {
        throw new NotFoundException(`ProductPurchase with ID ${id} not found`);
      }

      if (purchase.status === PurchaseStatus.CANCELLED) {
        throw new ConflictException('Purchase is already cancelled');
      }

      // 1 — Load movements
      const movements = await tx.inventoryMovement.findMany({
        where: { productPurchaseId: purchase.id },
      });

      // 2 — Reverse stock quantities
      for (const mov of movements) {
        await this.productStocksRepository.incrementQuantity(
          mov.stockId,
          new Prisma.Decimal(mov.quantity).negated(),
          tx,
        );
      }

      // 3 — Delete movements physically
      await tx.inventoryMovement.deleteMany({
        where: { productPurchaseId: purchase.id },
      });

      // 4 — Handle financials based on status
      if (purchase.status === PurchaseStatus.PENDING) {
        await tx.productPurchase.delete({ where: { id: purchase.id } });
      } else if (purchase.status === PurchaseStatus.COMPLETED) {
        if (!purchase.transactionId) {
          throw new ConflictException('Completed purchase is missing a transaction ID');
        }

        const originalTx = await tx.financialTransaction.findUnique({
          where: { id: purchase.transactionId },
        });

        if (!originalTx) {
          throw new ConflictException('Original financial transaction not found');
        }

        await this.financialTransactionsService.createTransaction(
          {
            organizationId,
            bankAccountId: originalTx.bankAccountId,
            type: TransactionType.CREDIT,
            amount: purchase.totalAmount,
            operationType: OperationType.REFUND,
            referenceId: purchase.id,
            referenceType: 'ProductPurchase',
            description: `Cancelación / Reembolso de compra de producto ${purchase.id}`,
            performedByUserId: userId,
          },
          tx,
        );

        await this.productPurchasesRepository.update(
          purchase.id,
          { status: PurchaseStatus.CANCELLED },
          tx,
        );
      }
    });
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  async findAll(query: FindProductPurchasesDto): Promise<PageDto<ProductPurchaseEntity>> {
    const where: Prisma.ProductPurchaseWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;

    const [items, count] = await this.productPurchasesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<ProductPurchaseEntity> {
    const organizationId = getTenantId();
    const record = await this.productPurchasesRepository.findById(id);
    if (!record) throw new NotFoundException(`ProductPurchase with ID ${id} not found`);
    if (organizationId && record.organizationId !== organizationId) {
      throw new NotFoundException(`ProductPurchase with ID ${id} not found`);
    }
    return record;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private calcTotal(items: CreateProductPurchaseItemDto[]): Prisma.Decimal {
    return items.reduce((acc, item) => {
      if (item.unitCost != null) {
        const lineTotal = new Prisma.Decimal(item.unitCost).times(new Prisma.Decimal(item.quantity));
        return acc.plus(lineTotal);
      }
      return acc;
    }, new Prisma.Decimal(0));
  }

  /**
   * Validates that all productIds belong to this org and have isPurchased = true,
   * then upserts their ProductStock records. Returns a map of `productId_location` -> `stockId`.
   */
  private async getOrCreateStocks(
    organizationId: string,
    items: CreateProductPurchaseItemDto[],
    tx: Prisma.TransactionClient,
  ): Promise<Map<string, string>> {
    const productIds = [...new Set(items.map((i) => i.productId))];

    const products = await tx.product.findMany({
      where: { id: { in: productIds }, organizationId },
      select: { id: true, isPurchased: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'One or more product IDs are invalid or do not belong to this organization',
      );
    }

    const notPurchasable = products.filter((p) => !p.isPurchased);
    if (notPurchasable.length > 0) {
      throw new BadRequestException(
        `Products [${notPurchasable.map((p) => p.id).join(', ')}] are not marked as purchasable (isPurchased = false)`,
      );
    }

    const stockMap = new Map<string, string>();
    for (const item of items) {
      const location = item.location || 'Principal';
      const key = `${item.productId}_${location}`;
      if (stockMap.has(key)) continue;

      const stock = await this.productStocksRepository.upsert(
        { productId: item.productId, location, organizationId },
        tx,
      );
      stockMap.set(key, stock.id);
    }

    return stockMap;
  }
}
