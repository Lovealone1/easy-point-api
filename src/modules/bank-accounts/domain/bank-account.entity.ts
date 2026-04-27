import { BankAccountStatus, Prisma } from '@prisma/client';

export class BankAccountEntity {
  readonly id: string;
  name: string;
  readonly balance: Prisma.Decimal;
  currency: string;
  readonly version: number;
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
