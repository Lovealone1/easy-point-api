
import { BankAccountStatus, Prisma } from '@prisma/client';

export class BankAccountEntity {
  readonly id: string;
  name: string;
  balance: Prisma.Decimal;
  currency: string;
  version: number;
  accountNumber: string | null;
  qrCode: string | null;
  status: BankAccountStatus;
  readonly organizationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    name: string;
    balance: Prisma.Decimal;
    currency: string;
    version: number;
    accountNumber: string | null;
    qrCode: string | null;
    status: BankAccountStatus;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.balance = params.balance;
    this.currency = params.currency;
    this.version = params.version;
    this.accountNumber = params.accountNumber;
    this.qrCode = params.qrCode;
    this.status = params.status;
    this.organizationId = params.organizationId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  /**
   * Incrementa el saldo de la cuenta bancaria.
   * La persistencia en DB debe asegurar la concurrencia usando el campo version.
   */
  increaseBalance(amount: Prisma.Decimal): void {
    if (amount.lessThan(0)) {
      throw new Error('Cannot increase balance by a negative amount');
    }
    this.balance = this.balance.add(amount);
    this.version += 1;
  }

  /**
   * Decrementa el saldo de la cuenta bancaria.
   * La persistencia en DB debe asegurar la concurrencia usando el campo version.
   */
  decreaseBalance(amount: Prisma.Decimal): void {
    if (amount.lessThan(0)) {
      throw new Error('Cannot decrease balance by a negative amount');
    }
    if (this.balance.lessThan(amount)) {
      throw new Error('Insufficient funds in the bank account');
    }
    this.balance = this.balance.sub(amount);
    this.version += 1;
  }

  static fromPrisma(raw: {
    id: string;
    name: string;
    balance: Prisma.Decimal;
    currency: string;
    version: number;
    accountNumber: string | null;
    qrCode: string | null;
    status: BankAccountStatus;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): BankAccountEntity {
    return new BankAccountEntity(raw);
  }
}
