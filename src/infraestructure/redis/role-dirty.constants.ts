/**
 * Prefijo de clave Redis para el dirty flag de roles.
 *
 * Cuando se asigna o revoca un permiso de un rol, se escribe:
 *   `role_dirty:{roleId}` = timestamp (ms) del momento del cambio
 *
 * El PermissionsGuard compara este timestamp con el `iat` del token JWT
 * para detectar si el token fue emitido antes del último cambio de permisos.
 */
export const ROLE_DIRTY_PREFIX = 'role_dirty:';

/**
 * TTL del dirty flag en segundos (24 horas).
 * Pasado este tiempo, el flag expira automáticamente de Redis.
 */
export const ROLE_DIRTY_TTL_SECONDS = 86_400;
