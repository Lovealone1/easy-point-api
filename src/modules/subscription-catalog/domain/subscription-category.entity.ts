export class SubscriptionCategoryEntity {
  readonly id: string;
  /** null for seeded system categories; set for user-authored ones. */
  readonly userId: string | null;
  key: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    userId: string | null;
    key: string;
    name: string;
    icon: string | null;
    color: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.userId = params.userId;
    this.key = params.key;
    this.name = params.name;
    this.icon = params.icon;
    this.color = params.color;
    this.sortOrder = params.sortOrder;
    this.isActive = params.isActive;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  /** System categories are seeded and read-only from the user-facing API. */
  get isSystem(): boolean {
    return this.userId === null;
  }

  static fromPrisma(raw: {
    id: string;
    userId: string | null;
    key: string;
    name: string;
    icon: string | null;
    color: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SubscriptionCategoryEntity {
    return new SubscriptionCategoryEntity(raw);
  }
}
