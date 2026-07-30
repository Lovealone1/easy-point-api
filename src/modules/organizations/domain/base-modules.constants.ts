/**
 * Módulos de gobierno de organización — siempre activos para toda
 * organización, sin excepción. No son seleccionables en el flujo de
 * auto-servicio (`organizations/self-service`).
 */
export const ADMIN_DEFAULT_MODULE_KEYS = [
  'organizations',
  'organization_configs',
  'organization_users',
  'roles',
  'role_permissions',
  'permissions',
  'invitations',
] as const;

/** Cantidad exacta de módulos base que un usuario debe elegir al crear su organización. */
export const BASE_MODULES_SELECTION_SIZE = 5;
