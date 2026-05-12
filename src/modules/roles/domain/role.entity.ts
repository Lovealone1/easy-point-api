export class RoleEntity {
  readonly id: string;
  readonly organizationId: string;
  name: string;
  description: string | null;
  readonly isSystemDefault: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    isSystemDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.name = params.name;
    this.description = params.description;
    this.isSystemDefault = params.isSystemDefault;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  /**
   * Mapeo desde infraestructura
   */
  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    isSystemDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): RoleEntity {
    return new RoleEntity({
      id: raw.id,
      organizationId: raw.organizationId,
      name: raw.name,
      description: raw.description,
      isSystemDefault: raw.isSystemDefault,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
