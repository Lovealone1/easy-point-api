import { Prisma } from '@prisma/client';
import { SubscriptionCategoryEntity } from './subscription-category.entity.js';

export class SubscriptionProviderEntity {
  readonly id: string;
  key: string;
  name: string;
  categoryId: string;
  logoUrl: string | null;
  brandColor: string | null;
  websiteUrl: string | null;
  description: string | null;
  isActive: boolean;
  metadata: Prisma.JsonValue | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  category?: SubscriptionCategoryEntity;

  constructor(params: {
    id: string;
    key: string;
    name: string;
    categoryId: string;
    logoUrl: string | null;
    brandColor: string | null;
    websiteUrl: string | null;
    description: string | null;
    isActive: boolean;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    category?: SubscriptionCategoryEntity;
  }) {
    this.id = params.id;
    this.key = params.key;
    this.name = params.name;
    this.categoryId = params.categoryId;
    this.logoUrl = params.logoUrl;
    this.brandColor = params.brandColor;
    this.websiteUrl = params.websiteUrl;
    this.description = params.description;
    this.isActive = params.isActive;
    this.metadata = params.metadata;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
    this.category = params.category;
  }

  static fromPrisma(raw: {
    id: string;
    key: string;
    name: string;
    categoryId: string;
    logoUrl: string | null;
    brandColor: string | null;
    websiteUrl: string | null;
    description: string | null;
    isActive: boolean;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    category?: {
      id: string;
      key: string;
      name: string;
      icon: string | null;
      color: string | null;
      sortOrder: number;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }): SubscriptionProviderEntity {
    return new SubscriptionProviderEntity({
      ...raw,
      category: raw.category ? SubscriptionCategoryEntity.fromPrisma(raw.category) : undefined,
    });
  }
}
