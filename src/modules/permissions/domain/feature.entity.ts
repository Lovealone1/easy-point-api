import { PermissionEntity } from './permission.entity.js';

export class FeatureEntity {
  readonly id: string;
  readonly moduleId: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly permissions?: PermissionEntity[];

  constructor(params: {
    id: string;
    moduleId: string;
    key: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
    permissions?: PermissionEntity[];
  }) {
    this.id = params.id;
    this.moduleId = params.moduleId;
    this.key = params.key;
    this.name = params.name;
    this.description = params.description;
    this.sortOrder = params.sortOrder;
    this.isActive = params.isActive;
    this.permissions = params.permissions;
  }

  static fromPrisma(
    raw: {
      id: string;
      moduleId: string;
      key: string;
      name: string;
      description: string | null;
      sortOrder: number;
      isActive: boolean;
    },
    permissions?: PermissionEntity[],
  ): FeatureEntity {
    return new FeatureEntity({ ...raw, permissions });
  }
}
