import { TransactionCategoryType } from '@prisma/client';

export class TransactionCategoryEntity {
  readonly id: string;
  name: string;
  description: string | null;
  type: TransactionCategoryType;
  isActive: boolean;
  readonly organizationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    name: string;
    description: string | null;
    type: TransactionCategoryType;
    isActive: boolean;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.type = params.type;
    this.isActive = params.isActive;
    this.organizationId = params.organizationId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  static fromPrisma(raw: {
    id: string;
    name: string;
    description: string | null;
    type: TransactionCategoryType;
    isActive: boolean;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): TransactionCategoryEntity {
    return new TransactionCategoryEntity({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      type: raw.type,
      isActive: raw.isActive,
      organizationId: raw.organizationId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
