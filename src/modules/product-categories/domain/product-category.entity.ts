/**
 * Entidad de dominio: ProductCategory
 *
 * Encapsula el estado y las reglas de negocio de una categoría de producto.
 * No depende de ningún ORM ni framework.
 *
 * Reglas de negocio:
 *  - El código de categoría siempre se almacena en UPPERCASE (3 caracteres alfanuméricos).
 *  - El nombre se almacena en Title Case.
 */
export class ProductCategoryEntity {
  readonly id: string;
  name: string;
  code: string;
  notes: string | null;
  isActive: boolean;
  readonly organizationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    name: string;
    code: string;
    notes: string | null;
    isActive: boolean;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.code = params.code;
    this.notes = params.notes;
    this.isActive = params.isActive;
    this.organizationId = params.organizationId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  // ---------------------------------------------------------------------------
  // Lógica de negocio
  // ---------------------------------------------------------------------------

  /**
   * Normaliza el código a UPPERCASE.
   * El DTO ya transforma el input, pero la entidad es la fuente de verdad
   * del invariante: el código SIEMPRE debe estar en mayúsculas.
   */
  normalizeCode(): void {
    this.code = this.code.toUpperCase().trim();
  }

  /**
   * Normaliza el nombre a Title Case.
   * El DTO ya transforma el input; este método es el invariante de dominio.
   */
  normalizeName(): void {
    this.name = this.name.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ---------------------------------------------------------------------------
  // Mapeo desde infraestructura
  // ---------------------------------------------------------------------------

  /**
   * Construye una ProductCategoryEntity desde el modelo raw de Prisma.
   * Único punto de entrada desde la base de datos.
   */
  static fromPrisma(raw: {
    id: string;
    name: string;
    code: string;
    notes: string | null;
    isActive: boolean;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): ProductCategoryEntity {
    return new ProductCategoryEntity({
      id: raw.id,
      name: raw.name,
      code: raw.code,
      notes: raw.notes,
      isActive: raw.isActive,
      organizationId: raw.organizationId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
