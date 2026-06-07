import { PermissionType } from '@prisma/client';

export class PermissionEntity {
  readonly id: string;
  readonly featureId: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: PermissionType;
  readonly sortOrder: number;
  readonly isActive: boolean;

  constructor(params: {
    id: string;
    featureId: string;
    key: string;
    name: string;
    description: string | null;
    type: PermissionType;
    sortOrder: number;
    isActive: boolean;
  }) {
    this.id = params.id;
    this.featureId = params.featureId;
    this.key = params.key;
    this.name = params.name;
    this.description = params.description;
    this.type = params.type;
    this.sortOrder = params.sortOrder;
    this.isActive = params.isActive;
  }

  static fromPrisma(raw: {
    id: string;
    featureId: string;
    key: string;
    name: string;
    description: string | null;
    type: PermissionType;
    sortOrder: number;
    isActive: boolean;
  }): PermissionEntity {
    return new PermissionEntity(raw);
  }
}
