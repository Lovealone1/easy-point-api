import { CardBrand } from '@prisma/client';

export class UserPaymentCardEntity {
  readonly id: string;
  readonly userId: string;
  label: string;
  brand: CardBrand;
  color: string;
  lastFourDigits: string | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  isDefault: boolean;
  isActive: boolean;
  notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  subscriptionCount?: number;
  monthlyTotal?: string;

  constructor(params: {
    id: string;
    userId: string;
    label: string;
    brand: CardBrand;
    color: string;
    lastFourDigits: string | null;
    statementDay: number | null;
    paymentDueDay: number | null;
    isDefault: boolean;
    isActive: boolean;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    subscriptionCount?: number;
    monthlyTotal?: string;
  }) {
    this.id = params.id;
    this.userId = params.userId;
    this.label = params.label;
    this.brand = params.brand;
    this.color = params.color;
    this.lastFourDigits = params.lastFourDigits;
    this.statementDay = params.statementDay;
    this.paymentDueDay = params.paymentDueDay;
    this.isDefault = params.isDefault;
    this.isActive = params.isActive;
    this.notes = params.notes;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
    this.subscriptionCount = params.subscriptionCount;
    this.monthlyTotal = params.monthlyTotal;
  }

  static fromPrisma(raw: {
    id: string;
    userId: string;
    label: string;
    brand: CardBrand;
    color: string;
    lastFourDigits: string | null;
    statementDay: number | null;
    paymentDueDay: number | null;
    isDefault: boolean;
    isActive: boolean;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserPaymentCardEntity {
    return new UserPaymentCardEntity(raw);
  }
}
