import { Prisma, DiscountType, DiscountScope, DiscountCategory } from '@prisma/client';

export class DiscountRuleEntity {
  readonly id: string;
  readonly organizationId: string;

  name: string;
  description: string | null;

  /**
   * Código corto único por organización (ej: "PROM25").
   * Se genera automáticamente a partir del nombre si no se provee.
   */
  code: string;

  type: DiscountType;
  /** Para PERCENTAGE: 0–100. Para FIXED_AMOUNT: monto en moneda local. */
  value: Prisma.Decimal;

  scope: DiscountScope;
  clientId: string | null;

  category: DiscountCategory;

  startsAt: Date | null;
  expiresAt: Date | null;

  /** Techo de descuento para PERCENTAGE (null = sin límite) */
  maxDiscountAmount: Prisma.Decimal | null;
  /** Monto mínimo de venta para que el descuento sea aplicable */
  minSaleAmount: Prisma.Decimal | null;

  maxUsages: number | null;
  usageCount: number;

  isActive: boolean;
  notes: string | null;

  readonly createdByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    code: string;
    type: DiscountType;
    value: Prisma.Decimal;
    scope: DiscountScope;
    clientId: string | null;
    category: DiscountCategory;
    startsAt: Date | null;
    expiresAt: Date | null;
    maxDiscountAmount: Prisma.Decimal | null;
    minSaleAmount: Prisma.Decimal | null;
    maxUsages: number | null;
    usageCount: number;
    isActive: boolean;
    notes: string | null;
    createdByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.name = params.name;
    this.description = params.description;
    this.code = params.code;
    this.type = params.type;
    this.value = params.value;
    this.scope = params.scope;
    this.clientId = params.clientId;
    this.category = params.category;
    this.startsAt = params.startsAt;
    this.expiresAt = params.expiresAt;
    this.maxDiscountAmount = params.maxDiscountAmount;
    this.minSaleAmount = params.minSaleAmount;
    this.maxUsages = params.maxUsages;
    this.usageCount = params.usageCount;
    this.isActive = params.isActive;
    this.notes = params.notes;
    this.createdByUserId = params.createdByUserId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  // ---------------------------------------------------------------------------
  // Business logic
  // ---------------------------------------------------------------------------

  /**
   * Incrementa el contador de usos. Se llama al aplicar el descuento a una venta.
   */
  incrementUsage(): void {
    this.usageCount += 1;
  }

  /**
   * Verifica si el descuento puede aplicarse en este momento:
   *  - Está activo
   *  - No ha expirado
   *  - No superó el límite de usos
   *  - El monto de venta cumple el mínimo (si se provee)
   */
  canApply(saleSubtotal: Prisma.Decimal): boolean {
    if (!this.isActive) return false;

    const now = new Date();
    if (this.startsAt && now < this.startsAt) return false;
    if (this.expiresAt && now > this.expiresAt) return false;

    if (this.maxUsages !== null && this.usageCount >= this.maxUsages) return false;

    if (this.minSaleAmount !== null && saleSubtotal.lessThan(this.minSaleAmount)) {
      return false;
    }

    return true;
  }

  /**
   * Calcula el monto de descuento real en moneda local dado un subtotal de venta.
   * Respeta el techo `maxDiscountAmount` para descuentos porcentuales.
   */
  computeDiscountAmount(subtotal: Prisma.Decimal): Prisma.Decimal {
    let amount: Prisma.Decimal;

    if (this.type === DiscountType.PERCENTAGE) {
      amount = subtotal.times(this.value).dividedBy(100);
      if (this.maxDiscountAmount !== null && amount.greaterThan(this.maxDiscountAmount)) {
        amount = this.maxDiscountAmount;
      }
    } else {
      amount = this.value;
    }

    // Descuento nunca puede superar el subtotal
    return amount.greaterThan(subtotal) ? subtotal : amount;
  }

  /**
   * Genera el código de descuento a partir del nombre.
   * Ej: "Promoción Verano 25%" → "PROMVER25"
   */
  static generateCode(name: string, value: number, type: DiscountType): string {
    const prefix = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.slice(0, 4))
      .join('');

    const suffix = type === DiscountType.PERCENTAGE ? Math.round(value).toString() : '';
    return `${prefix}${suffix}`.slice(0, 12);
  }

  appendNote(note: string): void {
    this.notes = this.notes ? `${this.notes}\n${note}` : note;
  }

  // ---------------------------------------------------------------------------
  // Infra mapping
  // ---------------------------------------------------------------------------

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    code: string;
    type: DiscountType;
    value: Prisma.Decimal;
    scope: DiscountScope;
    clientId: string | null;
    category: DiscountCategory;
    startsAt: Date | null;
    expiresAt: Date | null;
    maxDiscountAmount: Prisma.Decimal | null;
    minSaleAmount: Prisma.Decimal | null;
    maxUsages: number | null;
    usageCount: number;
    isActive: boolean;
    notes: string | null;
    createdByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): DiscountRuleEntity {
    return new DiscountRuleEntity(raw);
  }
}
