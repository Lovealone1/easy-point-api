import { Prisma } from '@prisma/client';
import {
  generateSku,
  extractCode,
  formatSequential,
} from '../../../common/utils/sku.util.js';
import { skuToEan13 } from '../../../common/utils/barcode.util.js';


export class ProductEntity {
  readonly id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  salePrice: Prisma.Decimal;
  costPrice: Prisma.Decimal | null;
  categoryId: string | null;
  isPurchased: boolean;
  recipeId: string | null;
  imageUrl: string | null;
  notes: string | null;
  isActive: boolean;
  readonly organizationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    name: string;
    description: string | null;
    sku: string | null;
    barcode: string | null;
    salePrice: Prisma.Decimal;
    costPrice: Prisma.Decimal | null;
    categoryId: string | null;
    isPurchased: boolean;
    recipeId: string | null;
    imageUrl: string | null;
    notes: string | null;
    isActive: boolean;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.sku = params.sku;
    this.barcode = params.barcode;
    this.salePrice = params.salePrice;
    this.costPrice = params.costPrice;
    this.categoryId = params.categoryId;
    this.isPurchased = params.isPurchased;
    this.recipeId = params.recipeId;
    this.imageUrl = params.imageUrl;
    this.notes = params.notes;
    this.isActive = params.isActive;
    this.organizationId = params.organizationId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  assignAutoSku(
    orgName: string,
    categoryCode: string | null,
    sequential: number,
  ): void {
    if (this.sku) return; // SKU manual proporcionado — no sobreescribir

    const catCode = categoryCode ?? 'GEN';
    this.sku = generateSku(orgName, catCode, this.name, sequential);
  }

  get productCode(): string {
    return extractCode(this.name);
  }

  static formatSeq(n: number): string {
    return formatSequential(n);
  }

  assignAutoBarcode(): void {
    if (this.barcode) return;
    if (!this.sku) return;
    this.barcode = skuToEan13(this.sku);
  }


  appendNote(note: string): void {
    this.notes = this.notes ? `${this.notes}\n${note}` : note;
  }


  hasPositiveMargin(): boolean {
    if (!this.costPrice) return true;
    return this.salePrice.greaterThan(this.costPrice);
  }


  static fromPrisma(raw: {
    id: string;
    name: string;
    description: string | null;
    sku: string | null;
    barcode: string | null;
    salePrice: Prisma.Decimal;
    costPrice: Prisma.Decimal | null;
    categoryId: string | null;
    isPurchased: boolean;
    recipeId: string | null;
    imageUrl: string | null;
    notes: string | null;
    isActive: boolean;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): ProductEntity {
    return new ProductEntity({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      sku: raw.sku,
      barcode: raw.barcode,
      salePrice: raw.salePrice,
      costPrice: raw.costPrice,
      categoryId: raw.categoryId,
      isPurchased: raw.isPurchased,
      recipeId: raw.recipeId,
      imageUrl: raw.imageUrl,
      notes: raw.notes,
      isActive: raw.isActive,
      organizationId: raw.organizationId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
