/**
 * Jerarquía de roles dentro de una organización.
 *
 * Solo OWNER y ADMINISTRATOR son roles de sistema con nombres fijos y garantizados.
 * Todos los demás roles son CUSTOM — creados por la organización con nombres arbitrarios
 * (ej. 'CAJERO', 'VENDEDOR', 'SUPERVISOR'). No tienen rango relativo entre sí.
 *
 * Jerarquía:
 *   OWNER (3) > ADMINISTRATOR (2) > Cualquier rol custom (1)
 *
 * GlobalRole.ADMIN (global) tiene bypass total en los guards — no pasa por aquí.
 */

/** Nombre de rol fijo: propietario de la organización */
export const SYSTEM_ROLE_OWNER = 'OWNER';

/** Nombre de rol fijo: administrador de la organización */
export const SYSTEM_ROLE_ADMINISTRATOR = 'ADMINISTRATOR';

/**
 * Devuelve el rango numérico de un rol por su nombre.
 *
 * - OWNER         → 3 (máximo)
 * - ADMINISTRATOR → 2
 * - Cualquier otro (roles custom) → 1
 *
 * @param roleName Nombre del rol (string arbitrario almacenado en DB)
 */
export function getRoleRank(roleName: string): number {
  if (roleName === SYSTEM_ROLE_OWNER) return 3;
  if (roleName === SYSTEM_ROLE_ADMINISTRATOR) return 2;
  return 1; // rol custom de organización
}

/**
 * El actor puede modificar o eliminar al target únicamente si su rango
 * es estrictamente mayor al rango del target.
 *
 * Ejemplos:
 *  - OWNER(3) modifica ADMINISTRATOR(2)  → true  ✅
 *  - OWNER(3) modifica CAJERO(1)         → true  ✅
 *  - ADMINISTRATOR(2) modifica CAJERO(1) → true  ✅
 *  - ADMINISTRATOR(2) modifica ADMINISTRATOR(2) → false ❌ (mismo nivel)
 *  - CAJERO(1) modifica VENDEDOR(1)      → false ❌ (mismo nivel, ambos custom)
 *  - CAJERO(1) modifica ADMINISTRATOR(2) → false ❌ (inferior)
 */
export function canActorModifyTarget(actorRoleName: string, targetRoleName: string): boolean {
  return getRoleRank(actorRoleName) > getRoleRank(targetRoleName);
}

/**
 * El actor solo puede asignar un rol cuyo rango sea estrictamente menor al suyo.
 * Esto impide que un ADMINISTRATOR pueda asignar el rol OWNER a otro miembro,
 * o que un rol custom pueda asignar roles de sistema.
 *
 * Ejemplos:
 *  - OWNER(3) asigna ADMINISTRATOR(2)  → true  ✅
 *  - OWNER(3) asigna CAJERO(1)         → true  ✅
 *  - ADMINISTRATOR(2) asigna CAJERO(1) → true  ✅
 *  - ADMINISTRATOR(2) asigna ADMINISTRATOR(2) → false ❌
 *  - ADMINISTRATOR(2) asigna OWNER(3)  → false ❌
 *  - CAJERO(1) asigna VENDEDOR(1)      → false ❌ (mismo rango custom)
 */
export function canActorAssignRole(actorRoleName: string, newRoleName: string): boolean {
  return getRoleRank(actorRoleName) > getRoleRank(newRoleName);
}
