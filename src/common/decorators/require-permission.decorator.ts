import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Decorator para proteger endpoints con un permiso granular específico.
 *
 * Uso:
 * @RequirePermission('sales:create')
 * @RequirePermission('employees:view_salary')
 *
 * Los roles sistema (OWNER, ADMINISTRATOR) bypasean este guard automáticamente.
 */
export const RequirePermission = (...permissionKeys: string[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissionKeys);
