export class CurrencyEntity {
  readonly code: string;
  numericCode: string;
  name: string;
  nameEs: string;
  symbol: string | null;
  decimalDigits: number;
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    code: string;
    numericCode: string;
    name: string;
    nameEs: string;
    symbol: string | null;
    decimalDigits: number;
    isActive: boolean;
    isPopular: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.code = params.code;
    this.numericCode = params.numericCode;
    this.name = params.name;
    this.nameEs = params.nameEs;
    this.symbol = params.symbol;
    this.decimalDigits = params.decimalDigits;
    this.isActive = params.isActive;
    this.isPopular = params.isPopular;
    this.sortOrder = params.sortOrder;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  /** What the picker shows: "COP — Peso colombiano". */
  get displayLabel(): string {
    return `${this.code} — ${this.nameEs}`;
  }

  static fromPrisma(raw: {
    code: string;
    numericCode: string;
    name: string;
    nameEs: string;
    symbol: string | null;
    decimalDigits: number;
    isActive: boolean;
    isPopular: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): CurrencyEntity {
    return new CurrencyEntity(raw);
  }
}
