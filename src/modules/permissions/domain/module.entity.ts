import { FeatureEntity } from './feature.entity.js';

export class ModuleEntity {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly icon: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly features?: FeatureEntity[];

  constructor(params: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    icon: string | null;
    sortOrder: number;
    isActive: boolean;
    features?: FeatureEntity[];
  }) {
    this.id = params.id;
    this.key = params.key;
    this.name = params.name;
    this.description = params.description;
    this.icon = params.icon;
    this.sortOrder = params.sortOrder;
    this.isActive = params.isActive;
    this.features = params.features;
  }

  static fromPrisma(
    raw: {
      id: string;
      key: string;
      name: string;
      description: string | null;
      icon: string | null;
      sortOrder: number;
      isActive: boolean;
    },
    features?: FeatureEntity[],
  ): ModuleEntity {
    return new ModuleEntity({ ...raw, features });
  }
}
