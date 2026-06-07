import { PermissionType } from '@prisma/client';

export interface PermissionDef {
  key: string;
  name: string;
  description?: string;
  type: PermissionType;
  sortOrder?: number;
}

export interface FeatureDef {
  key: string;
  name: string;
  description?: string;
  sortOrder?: number;
  permissions: PermissionDef[];
}

export interface ModuleDef {
  key: string;
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  features: FeatureDef[];
}

/**
 * Catálogo canónico de todos los módulos, features y permisos del sistema.
 *
 * Reglas:
 * - Nunca eliminar una key existente (puede romper asignaciones de roles).
 * - Para desactivar un permiso, agregar isActive: false en el seed y manejar en UI.
 * - Para agregar un nuevo módulo: añadir una entrada aquí y correr `pnpm prisma db seed`.
 */
export const PERMISSIONS_CATALOG: ModuleDef[] = [
  // ─── Ventas ─────────────────────────────────────────────────────────────────
  {
    key: 'sales',
    name: 'Ventas',
    description: 'Gestión de ventas y reportes comerciales',
    icon: 'ShoppingCart',
    sortOrder: 1,
    features: [
      {
        key: 'sales.management',
        name: 'Gestión de Ventas',
        description: 'Operaciones CRUD sobre ventas',
        sortOrder: 1,
        permissions: [
          { key: 'sales:create',          name: 'Crear venta',             type: 'CRUD',   sortOrder: 1 },
          { key: 'sales:read',            name: 'Ver ventas',              type: 'CRUD',   sortOrder: 2 },
          { key: 'sales:update',          name: 'Editar venta',            type: 'CRUD',   sortOrder: 3 },
          { key: 'sales:delete',          name: 'Eliminar venta',          type: 'CRUD',   sortOrder: 4 },
          { key: 'sales:cancel',          name: 'Cancelar venta',          type: 'ACTION', sortOrder: 5 },
          { key: 'sales:apply_discount',  name: 'Aplicar descuento',       type: 'ACTION', sortOrder: 6 },
          { key: 'sales:view_costs',      name: 'Ver costos y utilidad',   type: 'VIEW',   sortOrder: 7 },
          { key: 'sales:export',          name: 'Exportar ventas',         type: 'ACTION', sortOrder: 8 },
        ],
      },
      {
        key: 'sales.reports',
        name: 'Reportes de Ventas',
        sortOrder: 2,
        permissions: [
          { key: 'sales.reports:read', name: 'Ver reportes de ventas', type: 'VIEW', sortOrder: 1 },
        ],
      },
    ],
  },

  // ─── Inventario ─────────────────────────────────────────────────────────────
  {
    key: 'inventory',
    name: 'Inventario',
    description: 'Gestión de productos, stock y movimientos',
    icon: 'Package',
    sortOrder: 2,
    features: [
      {
        key: 'inventory.products',
        name: 'Productos',
        sortOrder: 1,
        permissions: [
          { key: 'products:create',     name: 'Crear producto',       type: 'CRUD',   sortOrder: 1 },
          { key: 'products:read',       name: 'Ver productos',        type: 'CRUD',   sortOrder: 2 },
          { key: 'products:update',     name: 'Editar producto',      type: 'CRUD',   sortOrder: 3 },
          { key: 'products:delete',     name: 'Eliminar producto',    type: 'CRUD',   sortOrder: 4 },
          { key: 'products:view_cost',  name: 'Ver precio de costo',  type: 'VIEW',   sortOrder: 5 },
        ],
      },
      {
        key: 'inventory.categories',
        name: 'Categorías de Productos',
        sortOrder: 2,
        permissions: [
          { key: 'product_categories:create', name: 'Crear categoría',    type: 'CRUD', sortOrder: 1 },
          { key: 'product_categories:read',   name: 'Ver categorías',     type: 'CRUD', sortOrder: 2 },
          { key: 'product_categories:update', name: 'Editar categoría',   type: 'CRUD', sortOrder: 3 },
          { key: 'product_categories:delete', name: 'Eliminar categoría', type: 'CRUD', sortOrder: 4 },
        ],
      },
      {
        key: 'inventory.movements',
        name: 'Movimientos de Inventario',
        sortOrder: 3,
        permissions: [
          { key: 'inventory:read',   name: 'Ver movimientos de inventario', type: 'CRUD',   sortOrder: 1 },
          { key: 'inventory:adjust', name: 'Ajustar inventario',            type: 'ACTION', sortOrder: 2 },
        ],
      },
    ],
  },

  // ─── Insumos ─────────────────────────────────────────────────────────────────
  {
    key: 'supplies',
    name: 'Insumos',
    description: 'Gestión de insumos, stock y movimientos',
    icon: 'Layers',
    sortOrder: 3,
    features: [
      {
        key: 'supplies.management',
        name: 'Gestión de Insumos',
        sortOrder: 1,
        permissions: [
          { key: 'supplies:create', name: 'Crear insumo',    type: 'CRUD', sortOrder: 1 },
          { key: 'supplies:read',   name: 'Ver insumos',     type: 'CRUD', sortOrder: 2 },
          { key: 'supplies:update', name: 'Editar insumo',   type: 'CRUD', sortOrder: 3 },
          { key: 'supplies:delete', name: 'Eliminar insumo', type: 'CRUD', sortOrder: 4 },
        ],
      },
      {
        key: 'supplies.movements',
        name: 'Movimientos de Insumos',
        sortOrder: 2,
        permissions: [
          { key: 'supply_movements:read',   name: 'Ver movimientos de insumos', type: 'CRUD',   sortOrder: 1 },
          { key: 'supply_movements:adjust', name: 'Ajustar stock de insumos',   type: 'ACTION', sortOrder: 2 },
        ],
      },
    ],
  },

  // ─── Producción ──────────────────────────────────────────────────────────────
  {
    key: 'production',
    name: 'Producción',
    description: 'Gestión de producciones y recetas',
    icon: 'Factory',
    sortOrder: 4,
    features: [
      {
        key: 'production.management',
        name: 'Gestión de Producciones',
        sortOrder: 1,
        permissions: [
          { key: 'productions:create',      name: 'Crear producción',           type: 'CRUD',   sortOrder: 1 },
          { key: 'productions:read',        name: 'Ver producciones',           type: 'CRUD',   sortOrder: 2 },
          { key: 'productions:update',      name: 'Editar producción',          type: 'CRUD',   sortOrder: 3 },
          { key: 'productions:delete',      name: 'Eliminar producción',        type: 'CRUD',   sortOrder: 4 },
          { key: 'productions:complete',    name: 'Completar producción',       type: 'ACTION', sortOrder: 5 },
          { key: 'productions:cancel',      name: 'Cancelar producción',        type: 'ACTION', sortOrder: 6 },
          { key: 'productions:view_costs',  name: 'Ver costos de producción',   type: 'VIEW',   sortOrder: 7 },
        ],
      },
      {
        key: 'production.recipes',
        name: 'Recetas',
        sortOrder: 2,
        permissions: [
          { key: 'recipes:create', name: 'Crear receta',    type: 'CRUD', sortOrder: 1 },
          { key: 'recipes:read',   name: 'Ver recetas',     type: 'CRUD', sortOrder: 2 },
          { key: 'recipes:update', name: 'Editar receta',   type: 'CRUD', sortOrder: 3 },
          { key: 'recipes:delete', name: 'Eliminar receta', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },

  // ─── Compras ─────────────────────────────────────────────────────────────────
  {
    key: 'purchases',
    name: 'Compras',
    description: 'Compras de insumos y productos a proveedores',
    icon: 'Truck',
    sortOrder: 5,
    features: [
      {
        key: 'purchases.supplies',
        name: 'Compras de Insumos',
        sortOrder: 1,
        permissions: [
          { key: 'supply_purchases:create', name: 'Registrar compra de insumo', type: 'CRUD', sortOrder: 1 },
          { key: 'supply_purchases:read',   name: 'Ver compras de insumos',     type: 'CRUD', sortOrder: 2 },
          { key: 'supply_purchases:delete', name: 'Eliminar compra de insumo',  type: 'CRUD', sortOrder: 3 },
        ],
      },
      {
        key: 'purchases.products',
        name: 'Compras de Productos',
        sortOrder: 2,
        permissions: [
          { key: 'product_purchases:create', name: 'Registrar compra de producto', type: 'CRUD', sortOrder: 1 },
          { key: 'product_purchases:read',   name: 'Ver compras de productos',     type: 'CRUD', sortOrder: 2 },
          { key: 'product_purchases:delete', name: 'Eliminar compra de producto',  type: 'CRUD', sortOrder: 3 },
        ],
      },
    ],
  },

  // ─── Clientes ────────────────────────────────────────────────────────────────
  {
    key: 'clients',
    name: 'Clientes',
    description: 'Gestión del catálogo de clientes',
    icon: 'Users',
    sortOrder: 6,
    features: [
      {
        key: 'clients.management',
        name: 'Gestión de Clientes',
        sortOrder: 1,
        permissions: [
          { key: 'clients:create',      name: 'Crear cliente',          type: 'CRUD', sortOrder: 1 },
          { key: 'clients:read',        name: 'Ver clientes',           type: 'CRUD', sortOrder: 2 },
          { key: 'clients:update',      name: 'Editar cliente',         type: 'CRUD', sortOrder: 3 },
          { key: 'clients:delete',      name: 'Eliminar cliente',       type: 'CRUD', sortOrder: 4 },
          { key: 'clients:view_credit', name: 'Ver límite de crédito',  type: 'VIEW', sortOrder: 5 },
        ],
      },
    ],
  },

  // ─── Proveedores ─────────────────────────────────────────────────────────────
  {
    key: 'suppliers',
    name: 'Proveedores',
    description: 'Gestión del catálogo de proveedores',
    icon: 'Building2',
    sortOrder: 7,
    features: [
      {
        key: 'suppliers.management',
        name: 'Gestión de Proveedores',
        sortOrder: 1,
        permissions: [
          { key: 'suppliers:create', name: 'Crear proveedor',    type: 'CRUD', sortOrder: 1 },
          { key: 'suppliers:read',   name: 'Ver proveedores',    type: 'CRUD', sortOrder: 2 },
          { key: 'suppliers:update', name: 'Editar proveedor',   type: 'CRUD', sortOrder: 3 },
          { key: 'suppliers:delete', name: 'Eliminar proveedor', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },

  // ─── Empleados ───────────────────────────────────────────────────────────────
  {
    key: 'employees',
    name: 'Empleados',
    description: 'Gestión de empleados de la organización',
    icon: 'UserCheck',
    sortOrder: 8,
    features: [
      {
        key: 'employees.management',
        name: 'Gestión de Empleados',
        sortOrder: 1,
        permissions: [
          { key: 'employees:create',       name: 'Crear empleado',       type: 'CRUD', sortOrder: 1 },
          { key: 'employees:read',         name: 'Ver empleados',        type: 'CRUD', sortOrder: 2 },
          { key: 'employees:update',       name: 'Editar empleado',      type: 'CRUD', sortOrder: 3 },
          { key: 'employees:delete',       name: 'Eliminar empleado',    type: 'CRUD', sortOrder: 4 },
          { key: 'employees:view_salary',  name: 'Ver salarios',         type: 'VIEW', sortOrder: 5 },
        ],
      },
    ],
  },

  // ─── Finanzas ────────────────────────────────────────────────────────────────
  {
    key: 'finances',
    name: 'Finanzas',
    description: 'Transacciones financieras y cuentas bancarias',
    icon: 'Landmark',
    sortOrder: 9,
    features: [
      {
        key: 'finances.transactions',
        name: 'Transacciones',
        sortOrder: 1,
        permissions: [
          { key: 'transactions:create', name: 'Registrar transacción', type: 'CRUD', sortOrder: 1 },
          { key: 'transactions:read',   name: 'Ver transacciones',     type: 'CRUD', sortOrder: 2 },
          { key: 'transactions:delete', name: 'Eliminar transacción',  type: 'CRUD', sortOrder: 3 },
        ],
      },
      {
        key: 'finances.bank_accounts',
        name: 'Cuentas Bancarias',
        sortOrder: 2,
        permissions: [
          { key: 'bank_accounts:create', name: 'Crear cuenta bancaria',   type: 'CRUD', sortOrder: 1 },
          { key: 'bank_accounts:read',   name: 'Ver cuentas bancarias',   type: 'CRUD', sortOrder: 2 },
          { key: 'bank_accounts:update', name: 'Editar cuenta bancaria',  type: 'CRUD', sortOrder: 3 },
          { key: 'bank_accounts:delete', name: 'Eliminar cuenta bancaria',type: 'CRUD', sortOrder: 4 },
        ],
      },
      {
        key: 'finances.categories',
        name: 'Categorías de Transacción',
        sortOrder: 3,
        permissions: [
          { key: 'transaction_categories:create', name: 'Crear categoría de transacción',    type: 'CRUD', sortOrder: 1 },
          { key: 'transaction_categories:read',   name: 'Ver categorías de transacción',     type: 'CRUD', sortOrder: 2 },
          { key: 'transaction_categories:update', name: 'Editar categoría de transacción',   type: 'CRUD', sortOrder: 3 },
          { key: 'transaction_categories:delete', name: 'Eliminar categoría de transacción', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },

  // ─── Descuentos ──────────────────────────────────────────────────────────────
  {
    key: 'discounts',
    name: 'Descuentos',
    description: 'Reglas y gestión de descuentos',
    icon: 'Tag',
    sortOrder: 10,
    features: [
      {
        key: 'discounts.management',
        name: 'Reglas de Descuento',
        sortOrder: 1,
        permissions: [
          { key: 'discounts:create', name: 'Crear regla de descuento',    type: 'CRUD', sortOrder: 1 },
          { key: 'discounts:read',   name: 'Ver reglas de descuento',     type: 'CRUD', sortOrder: 2 },
          { key: 'discounts:update', name: 'Editar regla de descuento',   type: 'CRUD', sortOrder: 3 },
          { key: 'discounts:delete', name: 'Eliminar regla de descuento', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },

  // ─── Configuración de Organización ───────────────────────────────────────────
  {
    key: 'org_settings',
    name: 'Configuración',
    description: 'Ajustes generales, roles, usuarios y permisos de la organización',
    icon: 'Settings',
    sortOrder: 11,
    features: [
      {
        key: 'org_settings.general',
        name: 'Ajustes Generales',
        sortOrder: 1,
        permissions: [
          { key: 'org_settings:read',   name: 'Ver configuración de organización',    type: 'CRUD', sortOrder: 1 },
          { key: 'org_settings:update', name: 'Editar configuración de organización', type: 'CRUD', sortOrder: 2 },
        ],
      },
      {
        key: 'org_settings.roles',
        name: 'Roles y Permisos',
        sortOrder: 2,
        permissions: [
          { key: 'roles:create',              name: 'Crear roles',                  type: 'CRUD',   sortOrder: 1 },
          { key: 'roles:read',                name: 'Ver roles',                    type: 'CRUD',   sortOrder: 2 },
          { key: 'roles:update',              name: 'Editar roles',                 type: 'CRUD',   sortOrder: 3 },
          { key: 'roles:delete',              name: 'Eliminar roles',               type: 'CRUD',   sortOrder: 4 },
          { key: 'roles:assign_permissions',  name: 'Asignar permisos a roles',     type: 'ACTION', sortOrder: 5 },
        ],
      },
      {
        key: 'org_settings.users',
        name: 'Usuarios de la Organización',
        sortOrder: 3,
        permissions: [
          { key: 'org_users:read',        name: 'Ver usuarios de la organización', type: 'CRUD',   sortOrder: 1 },
          { key: 'org_users:invite',      name: 'Invitar usuarios',                type: 'ACTION', sortOrder: 2 },
          { key: 'org_users:change_role', name: 'Cambiar rol de usuario',          type: 'ACTION', sortOrder: 3 },
          { key: 'org_users:remove',      name: 'Eliminar usuario de organización',type: 'ACTION', sortOrder: 4 },
        ],
      },
    ],
  },
];
