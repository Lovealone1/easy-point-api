import { Prisma } from '@prisma/client';

export class SupplyStockEntryEntity {
  readonly id: string;
  readonly organizationId: string;
  readonly supplyStockId: string;
  readonly supplyPurchaseId: string | null;
  readonly initialQuantity: Prisma.Decimal;
  remainingQuantity: Prisma.Decimal;
  readonly unitCost: Prisma.Decimal;
  isExhausted: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    supplyStockId: string;
    supplyPurchaseId: string | null;
    initialQuantity: Prisma.Decimal;
    remainingQuantity: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    isExhausted: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.supplyStockId = params.supplyStockId;
    this.supplyPurchaseId = params.supplyPurchaseId;
    this.initialQuantity = params.initialQuantity;
    this.remainingQuantity = params.remainingQuantity;
    this.unitCost = params.unitCost;
    this.isExhausted = params.isExhausted;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  /**
   * Consume una cantidad del lote. Descuenta parcialmente (unidades medibles)
   * o agota completamente (UNIT).
   * @param amount Cantidad a consumir
   * @param exhaustAll Si true, agota todo el lote independientemente de `amount`
   * @returns La cantidad efectivamente consumida
   */
  consume(amount: Prisma.Decimal, exhaustAll = false): Prisma.Decimal {
    if (this.isExhausted) {
      throw new Error(`SupplyStockEntry ${this.id} is already exhausted`);
    }

    if (exhaustAll) {
      const consumed = this.remainingQuantity;
      this.remainingQuantity = new Prisma.Decimal(0);
      this.isExhausted = true;
      return consumed;
    }

    if (amount.greaterThan(this.remainingQuantity)) {
      throw new Error(
        `Insufficient stock in entry ${this.id}: requested ${amount}, available ${this.remainingQuantity}`,
      );
    }

    this.remainingQuantity = this.remainingQuantity.minus(amount);
    if (this.remainingQuantity.isZero()) {
      this.isExhausted = true;
    }
    return amount;
  }

  /** Costo total de una cantidad determinada a este lote */
  costOf(amount: Prisma.Decimal): Prisma.Decimal {
    return this.unitCost.times(amount);
  }

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    supplyStockId: string;
    supplyPurchaseId: string | null;
    initialQuantity: Prisma.Decimal;
    remainingQuantity: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    isExhausted: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SupplyStockEntryEntity {
    return new SupplyStockEntryEntity({
      id: raw.id,
      organizationId: raw.organizationId,
      supplyStockId: raw.supplyStockId,
      supplyPurchaseId: raw.supplyPurchaseId,
      initialQuantity: raw.initialQuantity,
      remainingQuantity: raw.remainingQuantity,
      unitCost: raw.unitCost,
      isExhausted: raw.isExhausted,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
