import { Plan, OrganizationStatus } from '@prisma/client';

/**
 * Entidad de dominio: Organization
 *
 * Encapsula el estado y las reglas de negocio de una organización.
 * No depende de NestJS ni de Prisma como ORM.
 *
 * Reglas de negocio contenidas aquí:
 *  - Al cambiar el plan a FREE, planActiveUntil siempre se establece a null
 *    (invariante: FREE no tiene fecha de expiración de plan).
 *  - El slug se genera automáticamente a partir del nombre si no se provee.
 */
export class OrganizationEntity {
  readonly id: string;
  name: string;
  slug: string | null;
  email: string | null;
  plan: Plan;
  planActiveUntil: Date | null;
  status: OrganizationStatus;
  isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    name: string;
    slug: string | null;
    email: string | null;
    plan: Plan;
    planActiveUntil: Date | null;
    status: OrganizationStatus;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.slug = params.slug;
    this.email = params.email;
    this.plan = params.plan;
    this.planActiveUntil = params.planActiveUntil;
    this.status = params.status;
    this.isActive = params.isActive;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  // ---------------------------------------------------------------------------
  // Lógica de negocio — Plan
  // ---------------------------------------------------------------------------

  /**
   * Cambia el plan de la organización aplicando el invariante:
   *  - Si el nuevo plan es FREE → planActiveUntil se fuerza a null
   *    (los planes FREE no tienen fecha de expiración).
   *  - Para cualquier otro plan → planActiveUntil se actualiza con el
   *    valor provisto (puede ser null si el admin decide no establecer fecha).
   *
   * @param newPlan          Nuevo plan a asignar.
   * @param newActiveUntil   Nueva fecha de expiración (ignorada si plan = FREE).
   */
  applyPlanChange(newPlan: Plan, newActiveUntil: Date | null | undefined): void {
    this.plan = newPlan;

    if (newPlan === Plan.FREE) {
      // Invariante: plan FREE nunca tiene fecha de expiración
      this.planActiveUntil = null;
    } else {
      // Para planes de pago, se respeta el valor provisto
      if (newActiveUntil !== undefined) {
        this.planActiveUntil = newActiveUntil;
      }
      // Si newActiveUntil === undefined: no se modifica planActiveUntil actual
    }
  }

  // ---------------------------------------------------------------------------
  // Lógica de negocio — Slug
  // ---------------------------------------------------------------------------

  /**
   * Genera y asigna el slug automáticamente a partir del nombre si no se
   * provee uno explícito.
   *
   * Formato: lowercase, espacios → guiones, caracteres no alfanuméricos eliminados.
   * Ejemplo: "Mis Lindos Postres" → "mis-lindos-postres"
   */
  assignAutoSlug(): void {
    if (this.slug) return; // slug manual — no sobreescribir
    this.slug = this.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // eliminar acentos
      .replace(/[^a-z0-9\s-]/g, '')   // solo letras, números, espacios y guiones
      .trim()
      .replace(/\s+/g, '-');           // espacios → guiones
  }

  // ---------------------------------------------------------------------------
  // Mapeo desde infraestructura
  // ---------------------------------------------------------------------------

  /**
   * Construye una OrganizationEntity desde el modelo raw de Prisma.
   * Único punto de entrada desde la base de datos.
   */
  static fromPrisma(raw: {
    id: string;
    name: string;
    slug: string | null;
    email: string | null;
    plan: Plan;
    planActiveUntil: Date | null;
    status: OrganizationStatus;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): OrganizationEntity {
    return new OrganizationEntity({
      id: raw.id,
      name: raw.name,
      slug: raw.slug,
      email: raw.email,
      plan: raw.plan,
      planActiveUntil: raw.planActiveUntil,
      status: raw.status,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
