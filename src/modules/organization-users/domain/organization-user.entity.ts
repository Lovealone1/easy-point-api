import { Role } from '@prisma/client';

/**
 * Datos reducidos del User relacionado, cargados cuando se hace
 * findMany con include. Evita acoplar la entidad al modelo Prisma completo.
 */
export interface OrganizationUserMemberInfo {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
}

/**
 * Entidad de dominio: OrganizationUser
 *
 * Representa la membresía de un usuario en una organización.
 * No depende de NestJS ni de Prisma como ORM.
 *
 * Reglas de negocio contenidas aquí:
 *  - Una organización solo puede tener un OWNER a la vez.
 *    La entidad expone el método estático `validateSingleOwner` para
 *    verificar este invariante antes de persistir.
 *  - El rol predeterminado al crear una membresía es USER.
 *
 * Nota sobre el patrón de validación:
 *  La regla de "único OWNER" requiere conocer el estado de otros registros
 *  (countOwners), por lo que la validación se hace en el service usando datos
 *  provistos por el repository, y la entidad expone el método puro que
 *  aplica la regla sin dependencias externas.
 */
export class OrganizationUserEntity {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  role: Role;
  readonly joinedAt: Date;

  /** Datos del usuario relacionado — solo presente cuando se cargó con include */
  readonly user?: OrganizationUserMemberInfo;

  constructor(params: {
    id: string;
    userId: string;
    organizationId: string;
    role: Role;
    joinedAt: Date;
    user?: OrganizationUserMemberInfo;
  }) {
    this.id = params.id;
    this.userId = params.userId;
    this.organizationId = params.organizationId;
    this.role = params.role;
    this.joinedAt = params.joinedAt;
    this.user = params.user;
  }

  // ---------------------------------------------------------------------------
  // Lógica de negocio — roles
  // ---------------------------------------------------------------------------

  /**
   * Verifica el invariante de unicidad de OWNER.
   *
   * Retorna true si la asignación de `newRole` es válida dado el conteo
   * actual de owners en la organización.
   *
   * Regla: solo puede existir 1 OWNER por organización.
   * Si `newRole === OWNER` y ya hay al menos 1 owner → inválido.
   *
   * @param newRole      Rol que se intenta asignar.
   * @param ownerCount   Número actual de owners en la organización (desde el repository).
   * @param currentRole  Rol actual de la membresía (para update — evita contar el propio registro).
   */
  static canAssignRole(
    newRole: Role,
    ownerCount: number,
    currentRole?: Role,
  ): boolean {
    if (newRole !== Role.OWNER) return true;
    // Si el miembro ya es OWNER, no rompe el invariante reasignarle OWNER
    if (currentRole === Role.OWNER) return true;
    return ownerCount === 0;
  }

  /**
   * Aplica el nuevo rol a la entidad.
   */
  applyRoleChange(newRole: Role): void {
    this.role = newRole;
  }

  // ---------------------------------------------------------------------------
  // Mapeo desde infraestructura
  // ---------------------------------------------------------------------------

  /**
   * Construye una OrganizationUserEntity desde el modelo raw de Prisma.
   * Acepta opcionalmente los datos del user relacionado (include).
   */
  static fromPrisma(raw: {
    id: string;
    userId: string;
    organizationId: string;
    role: Role;
    joinedAt: Date;
    user?: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      isActive: boolean;
    } | null;
  }): OrganizationUserEntity {
    return new OrganizationUserEntity({
      id: raw.id,
      userId: raw.userId,
      organizationId: raw.organizationId,
      role: raw.role,
      joinedAt: raw.joinedAt,
      user: raw.user ?? undefined,
    });
  }
}
