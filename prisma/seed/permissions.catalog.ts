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

export const PERMISSIONS_CATALOG: ModuleDef[] = [
  // 1. bank_accounts
  {
    key: 'bank_accounts',
    name: 'Cuentas Bancarias',
    description: 'Gestión de cuentas bancarias de la organización',
    icon: 'Landmark',
    sortOrder: 1,
    features: [
      {
        key: 'bank_accounts.management',
        name: 'Gestión de Cuentas',
        description: 'Operaciones de configuración de cuentas bancarias',
        sortOrder: 1,
        permissions: [
          { key: 'bank_accounts:create', name: 'Crear cuenta bancaria', type: 'CRUD', sortOrder: 1 },
          { key: 'bank_accounts:read', name: 'Ver cuentas bancarias', type: 'CRUD', sortOrder: 2 },
          { key: 'bank_accounts:update', name: 'Editar cuenta bancaria', type: 'CRUD', sortOrder: 3 },
          { key: 'bank_accounts:delete', name: 'Eliminar cuenta bancaria', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },
  // 2. clients
  {
    key: 'clients',
    name: 'Clientes',
    description: 'Gestión de clientes y contactos',
    icon: 'Users',
    sortOrder: 2,
    features: [
      {
        key: 'clients.management',
        name: 'Gestión de Clientes',
        description: 'Administración de ficha de clientes',
        sortOrder: 1,
        permissions: [
          { key: 'clients:create', name: 'Crear cliente', type: 'CRUD', sortOrder: 1 },
          { key: 'clients:read', name: 'Ver clientes', type: 'CRUD', sortOrder: 2 },
          { key: 'clients:update', name: 'Editar cliente', type: 'CRUD', sortOrder: 3 },
          { key: 'clients:delete', name: 'Eliminar cliente', type: 'CRUD', sortOrder: 4 },
          { key: 'clients:view_credit', name: 'Ver límite de crédito', type: 'VIEW', sortOrder: 5 },
        ],
      },
    ],
  },
  // 3. discount_rules
  {
    key: 'discount_rules',
    name: 'Reglas de Descuento',
    description: 'Configuración de reglas y campañas de descuento',
    icon: 'Tag',
    sortOrder: 3,
    features: [
      {
        key: 'discount_rules.management',
        name: 'Reglas de Descuento',
        description: 'Definición de descuentos dinámicos para ventas',
        sortOrder: 1,
        permissions: [
          { key: 'discount_rules:create', name: 'Crear regla de descuento', type: 'CRUD', sortOrder: 1 },
          { key: 'discount_rules:read', name: 'Ver reglas de descuento', type: 'CRUD', sortOrder: 2 },
          { key: 'discount_rules:update', name: 'Editar regla de descuento', type: 'CRUD', sortOrder: 3 },
          { key: 'discount_rules:delete', name: 'Eliminar regla de descuento', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },
  // 4. employees
  {
    key: 'employees',
    name: 'Empleados',
    description: 'Gestión de empleados, salarios y contratos',
    icon: 'UserCheck',
    sortOrder: 4,
    features: [
      {
        key: 'employees.management',
        name: 'Gestión de Empleados',
        description: 'Ficha de personal y configuración salarial',
        sortOrder: 1,
        permissions: [
          { key: 'employees:create', name: 'Crear empleado', type: 'CRUD', sortOrder: 1 },
          { key: 'employees:read', name: 'Ver empleados', type: 'CRUD', sortOrder: 2 },
          { key: 'employees:update', name: 'Editar empleado', type: 'CRUD', sortOrder: 3 },
          { key: 'employees:delete', name: 'Eliminar empleado', type: 'CRUD', sortOrder: 4 },
          { key: 'employees:view_salary', name: 'Ver salarios', type: 'VIEW', sortOrder: 5 },
        ],
      },
    ],
  },
  // 5. financial_transactions
  {
    key: 'financial_transactions',
    name: 'Transacciones Financieras',
    description: 'Registro de ingresos, egresos y movimientos de caja',
    icon: 'DollarSign',
    sortOrder: 5,
    features: [
      {
        key: 'financial_transactions.management',
        name: 'Gestión de Transacciones',
        description: 'Movimientos financieros generales',
        sortOrder: 1,
        permissions: [
          { key: 'financial_transactions:create', name: 'Registrar transacción', type: 'CRUD', sortOrder: 1 },
          { key: 'financial_transactions:read', name: 'Ver transacciones', type: 'CRUD', sortOrder: 2 },
          { key: 'financial_transactions:delete', name: 'Eliminar transacción', type: 'CRUD', sortOrder: 3 },
        ],
      },
    ],
  },
  // 6. inventory_movements
  {
    key: 'inventory_movements',
    name: 'Movimientos de Inventario',
    description: 'Control de entradas, salidas y ajustes de stock de productos',
    icon: 'ArrowUpDown',
    sortOrder: 6,
    features: [
      {
        key: 'inventory_movements.management',
        name: 'Movimientos de Inventario',
        description: 'Control del Kardex de productos',
        sortOrder: 1,
        permissions: [
          { key: 'inventory_movements:read', name: 'Ver movimientos de inventario', type: 'CRUD', sortOrder: 1 },
          { key: 'inventory_movements:adjust', name: 'Ajustar inventario', type: 'ACTION', sortOrder: 2 },
        ],
      },
    ],
  },
  // 7. invitations
  {
    key: 'invitations',
    name: 'Invitaciones',
    description: 'Invitaciones para nuevos miembros de la organización',
    icon: 'MailOpen',
    sortOrder: 7,
    features: [
      {
        key: 'invitations.management',
        name: 'Gestión de Invitaciones',
        description: 'Proceso de incorporación de colaboradores',
        sortOrder: 1,
        permissions: [
          { key: 'invitations:create', name: 'Crear invitación', type: 'CRUD', sortOrder: 1 },
          { key: 'invitations:read', name: 'Ver invitaciones', type: 'CRUD', sortOrder: 2 },
          { key: 'invitations:cancel', name: 'Cancelar invitación', type: 'ACTION', sortOrder: 3 },
        ],
      },
    ],
  },
  // 8. organization_configs
  {
    key: 'organization_configs',
    name: 'Configuración de Organización',
    description: 'Parámetros y configuraciones generales del tenant',
    icon: 'Sliders',
    sortOrder: 8,
    features: [
      {
        key: 'organization_configs.management',
        name: 'Ajustes Generales',
        description: 'Configuración visual y parámetros de negocio',
        sortOrder: 1,
        permissions: [
          { key: 'organization_configs:read', name: 'Ver configuración de organización', type: 'CRUD', sortOrder: 1 },
          { key: 'organization_configs:update', name: 'Editar configuración de organización', type: 'CRUD', sortOrder: 2 },
        ],
      },
    ],
  },
  // 9. organization_users
  {
    key: 'organization_users',
    name: 'Usuarios de la Organización',
    description: 'Gestión de miembros y roles asignados dentro de la org',
    icon: 'Users2',
    sortOrder: 9,
    features: [
      {
        key: 'organization_users.management',
        name: 'Miembros de la Organización',
        description: 'Visualización y control de miembros del equipo',
        sortOrder: 1,
        permissions: [
          { key: 'organization_users:read', name: 'Ver usuarios de la organización', type: 'CRUD', sortOrder: 1 },
          { key: 'organization_users:change_role', name: 'Cambiar rol de usuario', type: 'ACTION', sortOrder: 2 },
          { key: 'organization_users:remove', name: 'Eliminar usuario de organización', type: 'ACTION', sortOrder: 3 },
        ],
      },
    ],
  },
  // 10. organizations
  {
    key: 'organizations',
    name: 'Información de la Organización',
    description: 'Datos de facturación, plan y perfil de la organización',
    icon: 'Building',
    sortOrder: 10,
    features: [
      {
        key: 'organizations.management',
        name: 'Perfil de Organización',
        description: 'Administración del tenant',
        sortOrder: 1,
        permissions: [
          { key: 'organizations:read', name: 'Ver perfil de organización', type: 'CRUD', sortOrder: 1 },
          { key: 'organizations:update', name: 'Editar perfil de organización', type: 'CRUD', sortOrder: 2 },
        ],
      },
    ],
  },
  // 11. permissions
  {
    key: 'permissions',
    name: 'Permisos',
    description: 'Visualización y auditoría del catálogo de permisos',
    icon: 'ShieldAlert',
    sortOrder: 11,
    features: [
      {
        key: 'permissions.management',
        name: 'Visualización de Permisos',
        description: 'Auditoría del mapa de permisos',
        sortOrder: 1,
        permissions: [
          { key: 'permissions:read', name: 'Ver catálogo de permisos', type: 'CRUD', sortOrder: 1 },
        ],
      },
    ],
  },
  // 12. product_categories
  {
    key: 'product_categories',
    name: 'Categorías de Productos',
    description: 'Clasificación de productos del inventario',
    icon: 'Layers',
    sortOrder: 12,
    features: [
      {
        key: 'product_categories.management',
        name: 'Categorías de Productos',
        description: 'Estructuración de categorías para el catálogo',
        sortOrder: 1,
        permissions: [
          { key: 'product_categories:create', name: 'Crear categoría', type: 'CRUD', sortOrder: 1 },
          { key: 'product_categories:read', name: 'Ver categorías', type: 'CRUD', sortOrder: 2 },
          { key: 'product_categories:update', name: 'Editar categoría', type: 'CRUD', sortOrder: 3 },
          { key: 'product_categories:delete', name: 'Eliminar categoría', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },
  // 13. product_purchases
  {
    key: 'product_purchases',
    name: 'Compras de Productos',
    description: 'Registro de compras de mercancía a proveedores',
    icon: 'ShoppingBag',
    sortOrder: 13,
    features: [
      {
        key: 'product_purchases.management',
        name: 'Compras de Productos',
        description: 'Gestión de reabastecimiento de productos',
        sortOrder: 1,
        permissions: [
          { key: 'product_purchases:create', name: 'Registrar compra de producto', type: 'CRUD', sortOrder: 1 },
          { key: 'product_purchases:read', name: 'Ver compras de productos', type: 'CRUD', sortOrder: 2 },
          { key: 'product_purchases:delete', name: 'Eliminar compra de producto', type: 'CRUD', sortOrder: 3 },
        ],
      },
    ],
  },
  // 14. product_stocks
  {
    key: 'product_stocks',
    name: 'Stock de Productos',
    description: 'Control de inventario físico y existencias',
    icon: 'BarChart2',
    sortOrder: 14,
    features: [
      {
        key: 'product_stocks.management',
        name: 'Control de Stock de Productos',
        description: 'Visualización y actualización directa de stock',
        sortOrder: 1,
        permissions: [
          { key: 'product_stocks:read', name: 'Ver stock de productos', type: 'CRUD', sortOrder: 1 },
          { key: 'product_stocks:update', name: 'Editar stock de productos', type: 'CRUD', sortOrder: 2 },
        ],
      },
    ],
  },
  // 15. production_supply_usages
  {
    key: 'production_supply_usages',
    name: 'Consumo de Insumos',
    description: 'Registro de insumos utilizados en los procesos de producción',
    icon: 'Activity',
    sortOrder: 15,
    features: [
      {
        key: 'production_supply_usages.management',
        name: 'Consumo de Insumos',
        description: 'Visualización de consumos de materias primas por orden',
        sortOrder: 1,
        permissions: [
          { key: 'production_supply_usages:read', name: 'Ver consumos de insumos', type: 'CRUD', sortOrder: 1 },
        ],
      },
    ],
  },
  // 16. productions
  {
    key: 'productions',
    name: 'Producción',
    description: 'Órdenes de producción y control de manufactura',
    icon: 'Wrench',
    sortOrder: 16,
    features: [
      {
        key: 'productions.management',
        name: 'Gestión de Producción',
        description: 'Planificación y estados de órdenes de producción',
        sortOrder: 1,
        permissions: [
          { key: 'productions:create', name: 'Crear producción', type: 'CRUD', sortOrder: 1 },
          { key: 'productions:read', name: 'Ver producciones', type: 'CRUD', sortOrder: 2 },
          { key: 'productions:update', name: 'Editar producción', type: 'CRUD', sortOrder: 3 },
          { key: 'productions:delete', name: 'Eliminar producción', type: 'CRUD', sortOrder: 4 },
          { key: 'productions:complete', name: 'Completar producción', type: 'ACTION', sortOrder: 5 },
          { key: 'productions:cancel', name: 'Cancelar producción', type: 'ACTION', sortOrder: 6 },
          { key: 'productions:view_costs', name: 'Ver costos de producción', type: 'VIEW', sortOrder: 7 },
        ],
      },
    ],
  },
  // 17. products
  {
    key: 'products',
    name: 'Productos',
    description: 'Catálogo de productos de venta',
    icon: 'Package',
    sortOrder: 17,
    features: [
      {
        key: 'products.management',
        name: 'Catálogo de Productos',
        description: 'Operaciones sobre la lista de productos',
        sortOrder: 1,
        permissions: [
          { key: 'products:create', name: 'Crear producto', type: 'CRUD', sortOrder: 1 },
          { key: 'products:read', name: 'Ver productos', type: 'CRUD', sortOrder: 2 },
          { key: 'products:update', name: 'Editar producto', type: 'CRUD', sortOrder: 3 },
          { key: 'products:delete', name: 'Eliminar producto', type: 'CRUD', sortOrder: 4 },
          { key: 'products:view_cost', name: 'Ver precio de costo', type: 'VIEW', sortOrder: 5 },
        ],
      },
    ],
  },
  // 18. recipes
  {
    key: 'recipes',
    name: 'Recetas / Fórmulas',
    description: 'Definición de recetas para productos producidos',
    icon: 'FileText',
    sortOrder: 18,
    features: [
      {
        key: 'recipes.management',
        name: 'Gestión de Recetas',
        description: 'Estructura de costos de insumos para productos',
        sortOrder: 1,
        permissions: [
          { key: 'recipes:create', name: 'Crear receta', type: 'CRUD', sortOrder: 1 },
          { key: 'recipes:read', name: 'Ver recetas', type: 'CRUD', sortOrder: 2 },
          { key: 'recipes:update', name: 'Editar receta', type: 'CRUD', sortOrder: 3 },
          { key: 'recipes:delete', name: 'Eliminar receta', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },
  // 19. role_permissions
  {
    key: 'role_permissions',
    name: 'Permisos de Roles',
    description: 'Control y asignación de permisos a roles',
    icon: 'ShieldCheck',
    sortOrder: 19,
    features: [
      {
        key: 'role_permissions.management',
        name: 'Asignación de Permisos',
        description: 'Control detallado de permisos por rol',
        sortOrder: 1,
        permissions: [
          { key: 'role_permissions:read', name: 'Ver permisos asignados', type: 'CRUD', sortOrder: 1 },
          { key: 'role_permissions:update', name: 'Modificar asignaciones de permisos', type: 'CRUD', sortOrder: 2 },
        ],
      },
    ],
  },
  // 20. roles
  {
    key: 'roles',
    name: 'Roles',
    description: 'Definición y jerarquía de roles organizacionales',
    icon: 'Shield',
    sortOrder: 20,
    features: [
      {
        key: 'roles.management',
        name: 'Gestión de Roles',
        description: 'CRUD de roles del tenant',
        sortOrder: 1,
        permissions: [
          { key: 'roles:create', name: 'Crear roles', type: 'CRUD', sortOrder: 1 },
          { key: 'roles:read', name: 'Ver roles', type: 'CRUD', sortOrder: 2 },
          { key: 'roles:update', name: 'Editar roles', type: 'CRUD', sortOrder: 3 },
          { key: 'roles:delete', name: 'Eliminar roles', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },
  // 21. sale_item_utilities
  {
    key: 'sale_item_utilities',
    name: 'Utilidad por Ítem',
    description: 'Reportes de utilidad y costos por producto vendido',
    icon: 'Percent',
    sortOrder: 21,
    features: [
      {
        key: 'sale_item_utilities.management',
        name: 'Utilidad de Ítems Vendidos',
        description: 'Detalle de rentabilidad a nivel de producto en venta',
        sortOrder: 1,
        permissions: [
          { key: 'sale_item_utilities:read', name: 'Ver utilidades por ítem', type: 'CRUD', sortOrder: 1 },
        ],
      },
    ],
  },
  // 22. sale_utilities
  {
    key: 'sale_utilities',
    name: 'Utilidades de Ventas',
    description: 'Análisis financiero y rentabilidad de ventas',
    icon: 'TrendingUp',
    sortOrder: 22,
    features: [
      {
        key: 'sale_utilities.management',
        name: 'Utilidad de Ventas',
        description: 'Reporte global de ganancias por ventas y periodos',
        sortOrder: 1,
        permissions: [
          { key: 'sale_utilities:read', name: 'Ver utilidad de ventas', type: 'CRUD', sortOrder: 1 },
          { key: 'sale_utilities:read_summary', name: 'Ver resumen KPIs utilidad', type: 'VIEW', sortOrder: 2 },
        ],
      },
    ],
  },
  // 23. sales
  {
    key: 'sales',
    name: 'Ventas',
    description: 'Facturación y registro de ventas a clientes',
    icon: 'ShoppingCart',
    sortOrder: 23,
    features: [
      {
        key: 'sales.management',
        name: 'Gestión de Ventas',
        description: 'Facturación y emisión de comprobantes de ventas',
        sortOrder: 1,
        permissions: [
          { key: 'sales:create', name: 'Crear venta', type: 'CRUD', sortOrder: 1 },
          { key: 'sales:read', name: 'Ver ventas', type: 'CRUD', sortOrder: 2 },
          { key: 'sales:update', name: 'Editar venta', type: 'CRUD', sortOrder: 3 },
          { key: 'sales:delete', name: 'Eliminar venta', type: 'CRUD', sortOrder: 4 },
          { key: 'sales:cancel', name: 'Cancelar venta', type: 'ACTION', sortOrder: 5 },
          { key: 'sales:apply_discount', name: 'Aplicar descuento', type: 'ACTION', sortOrder: 6 },
          { key: 'sales:view_costs', name: 'Ver costos y utilidad', type: 'VIEW', sortOrder: 7 },
          { key: 'sales:export', name: 'Exportar ventas', type: 'ACTION', sortOrder: 8 },
        ],
      },
    ],
  },
  // 24. suppliers
  {
    key: 'suppliers',
    name: 'Proveedores',
    description: 'Catálogo de proveedores de insumos y productos',
    icon: 'Truck',
    sortOrder: 24,
    features: [
      {
        key: 'suppliers.management',
        name: 'Gestión de Proveedores',
        description: 'Administración de fichas de proveedores',
        sortOrder: 1,
        permissions: [
          { key: 'suppliers:create', name: 'Crear proveedor', type: 'CRUD', sortOrder: 1 },
          { key: 'suppliers:read', name: 'Ver proveedores', type: 'CRUD', sortOrder: 2 },
          { key: 'suppliers:update', name: 'Editar proveedor', type: 'CRUD', sortOrder: 3 },
          { key: 'suppliers:delete', name: 'Eliminar proveedor', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },
  // 25. supplies
  {
    key: 'supplies',
    name: 'Insumos',
    description: 'Catálogo de materias primas e insumos',
    icon: 'Archive',
    sortOrder: 25,
    features: [
      {
        key: 'supplies.management',
        name: 'Gestión de Insumos',
        description: 'Control de la lista de materias primas',
        sortOrder: 1,
        permissions: [
          { key: 'supplies:create', name: 'Crear insumo', type: 'CRUD', sortOrder: 1 },
          { key: 'supplies:read', name: 'Ver insumos', type: 'CRUD', sortOrder: 2 },
          { key: 'supplies:update', name: 'Editar insumo', type: 'CRUD', sortOrder: 3 },
          { key: 'supplies:delete', name: 'Eliminar insumo', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },
  // 26. supply_movements
  {
    key: 'supply_movements',
    name: 'Movimientos de Insumos',
    description: 'Kardex de entradas y salidas de materias primas',
    icon: 'RefreshCw',
    sortOrder: 26,
    features: [
      {
        key: 'supply_movements.management',
        name: 'Movimientos de Insumos',
        description: 'Historial de movimientos de inventario de insumos',
        sortOrder: 1,
        permissions: [
          { key: 'supply_movements:read', name: 'Ver movimientos de insumos', type: 'CRUD', sortOrder: 1 },
          { key: 'supply_movements:adjust', name: 'Ajustar stock de insumos', type: 'ACTION', sortOrder: 2 },
        ],
      },
    ],
  },
  // 27. supply_purchases
  {
    key: 'supply_purchases',
    name: 'Compras de Insumos',
    description: 'Registro de compras de materias primas',
    icon: 'CreditCard',
    sortOrder: 27,
    features: [
      {
        key: 'supply_purchases.management',
        name: 'Compras de Insumos',
        description: 'Reabastecimiento de insumos',
        sortOrder: 1,
        permissions: [
          { key: 'supply_purchases:create', name: 'Registrar compra de insumo', type: 'CRUD', sortOrder: 1 },
          { key: 'supply_purchases:read', name: 'Ver compras de insumos', type: 'CRUD', sortOrder: 2 },
          { key: 'supply_purchases:delete', name: 'Eliminar compra de insumo', type: 'CRUD', sortOrder: 3 },
        ],
      },
    ],
  },
  // 28. supply_stock_entries
  {
    key: 'supply_stock_entries',
    name: 'Entradas de Stock de Insumos',
    description: 'Ingresos de materias primas por compras o ajustes',
    icon: 'PlusCircle',
    sortOrder: 28,
    features: [
      {
        key: 'supply_stock_entries.management',
        name: 'Entradas de Stock de Insumos',
        description: 'Control de lotes y entradas físicas de insumos',
        sortOrder: 1,
        permissions: [
          { key: 'supply_stock_entries:create', name: 'Crear entrada de insumo', type: 'CRUD', sortOrder: 1 },
          { key: 'supply_stock_entries:read', name: 'Ver entradas de insumos', type: 'CRUD', sortOrder: 2 },
        ],
      },
    ],
  },
  // 29. supply_stocks
  {
    key: 'supply_stocks',
    name: 'Stock de Insumos',
    description: 'Control de inventario físico de materias primas',
    icon: 'Database',
    sortOrder: 29,
    features: [
      {
        key: 'supply_stocks.management',
        name: 'Stock de Insumos',
        description: 'Visualización y actualización directa de existencias',
        sortOrder: 1,
        permissions: [
          { key: 'supply_stocks:read', name: 'Ver stock de insumos', type: 'CRUD', sortOrder: 1 },
          { key: 'supply_stocks:update', name: 'Editar stock de insumos', type: 'CRUD', sortOrder: 2 },
        ],
      },
    ],
  },
  // 30. transaction_categories
  {
    key: 'transaction_categories',
    name: 'Categorías de Transacción',
    description: 'Clasificación de conceptos de ingresos y egresos',
    icon: 'List',
    sortOrder: 30,
    features: [
      {
        key: 'transaction_categories.management',
        name: 'Categorías de Transacción',
        description: 'Estructuración de categorías financieras',
        sortOrder: 1,
        permissions: [
          { key: 'transaction_categories:create', name: 'Crear categoría de transacción', type: 'CRUD', sortOrder: 1 },
          { key: 'transaction_categories:read', name: 'Ver categorías de transacción', type: 'CRUD', sortOrder: 2 },
          { key: 'transaction_categories:update', name: 'Editar categoría de transacción', type: 'CRUD', sortOrder: 3 },
          { key: 'transaction_categories:delete', name: 'Eliminar categoría de transacción', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },
  // 31. expense_categories
  {
    key: 'expense_categories',
    name: 'Categorías de Gastos',
    description: 'Clasificación de conceptos de gastos',
    icon: 'FolderOpen',
    sortOrder: 31,
    features: [
      {
        key: 'expense_categories.management',
        name: 'Categorías de Gastos',
        description: 'Estructuración de categorías de gastos',
        sortOrder: 1,
        permissions: [
          { key: 'expense_categories:create', name: 'Crear categoría de gasto', type: 'CRUD', sortOrder: 1 },
          { key: 'expense_categories:read', name: 'Ver categorías de gastos', type: 'CRUD', sortOrder: 2 },
          { key: 'expense_categories:update', name: 'Editar categoría de gasto', type: 'CRUD', sortOrder: 3 },
          { key: 'expense_categories:delete', name: 'Eliminar categoría de gasto', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },
  // 32. expenses
  {
    key: 'expenses',
    name: 'Gastos',
    description: 'Gestión y control de gastos de la organización',
    icon: 'TrendingDown',
    sortOrder: 32,
    features: [
      {
        key: 'expenses.management',
        name: 'Gestión de Gastos',
        description: 'Registro de gastos y egresos asociados a cuentas bancarias',
        sortOrder: 1,
        permissions: [
          { key: 'expenses:create', name: 'Registrar gasto', type: 'CRUD', sortOrder: 1 },
          { key: 'expenses:read', name: 'Ver gastos', type: 'CRUD', sortOrder: 2 },
          { key: 'expenses:update', name: 'Editar gasto', type: 'CRUD', sortOrder: 3 },
          { key: 'expenses:delete', name: 'Eliminar gasto', type: 'CRUD', sortOrder: 4 },
        ],
      },
    ],
  },
];
