import { ClientType, EmployeeStatus, TransactionCategoryType, UnitOfMeasure } from '@prisma/client';

export type ImportResource =
  | 'clients'
  | 'suppliers'
  | 'employees'
  | 'products'
  | 'supplies'
  | 'product-categories'
  | 'expense-categories'
  | 'transaction-categories';

export type ImportValue = string | number | boolean | Date | null | undefined;

export interface ImportColumn {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example?: string;
  enumValues?: string[];
  aliases?: string[];
}

export interface ParsedImportRow {
  rowNumber: number;
  values: Record<string, ImportValue>;
}

export interface ImportValidationError {
  row: number;
  column?: string;
  code: string;
  message: string;
}

export interface ImportValidationResult {
  valid: boolean;
  resource: ImportResource;
  fileHash: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: Array<Record<string, ImportValue> & { __row: number }>;
  errors: ImportValidationError[];
}

export interface ImportDefinition {
  resource: ImportResource;
  title: string;
  permission: string;
  columns: ImportColumn[];
}

export const IMPORT_DEFINITIONS: Record<ImportResource, ImportDefinition> = {
  clients: {
    resource: 'clients', title: 'Clientes', permission: 'clients:create', columns: [
      { key: 'name', label: 'Nombre', required: true, description: 'Nombre completo o razón social', example: 'Acme S.A.S.' },
      { key: 'taxId', label: 'Documento', required: false, description: 'Cédula, NIT, RUT o RFC', example: '900123456-7' },
      { key: 'email', label: 'Correo', required: false, description: 'Correo electrónico válido', example: 'cliente@correo.com' },
      { key: 'phone', label: 'Teléfono', required: true, description: 'Número de contacto', example: '+57 300 000 0000' },
      { key: 'address', label: 'Dirección', required: false, description: 'Dirección física', example: 'Calle 10 # 20-30' },
      { key: 'creditLimit', label: 'Límite de crédito', required: true, description: 'Número mayor o igual a cero', example: '0' },
      { key: 'clientType', label: 'Tipo', required: false, description: 'INDIVIDUAL o COMPANY', example: ClientType.INDIVIDUAL, enumValues: Object.values(ClientType) },
      { key: 'notes', label: 'Notas', required: false, description: 'Notas internas', example: 'Cliente frecuente' },
    ],
  },
  suppliers: {
    resource: 'suppliers', title: 'Proveedores', permission: 'suppliers:create', columns: [
      { key: 'name', label: 'Nombre', required: true, description: 'Nombre del proveedor', example: 'Distribuciones ABC' },
      { key: 'taxId', label: 'Documento', required: true, description: 'Documento tributario', example: '900123456-7' },
      { key: 'email', label: 'Correo', required: true, description: 'Correo electrónico válido', example: 'ventas@proveedor.com' },
      { key: 'phone', label: 'Teléfono', required: true, description: 'Número de contacto', example: '+57 300 000 0000' },
      { key: 'address', label: 'Dirección', required: true, description: 'Dirección física', example: 'Carrera 10 # 20-30' },
      { key: 'bankAccount', label: 'Cuenta bancaria', required: false, description: 'Cuenta bancaria o IBAN', example: '000123456' },
      { key: 'leadTime', label: 'Días de entrega', required: true, description: 'Número entero mayor o igual a cero', example: '3' },
      { key: 'paymentTerms', label: 'Condiciones de pago', required: false, description: 'Descripción de condiciones', example: 'Crédito 30 días' },
      { key: 'notes', label: 'Notas', required: false, description: 'Notas internas', example: 'Entrega semanal' },
    ],
  },
  employees: {
    resource: 'employees', title: 'Empleados', permission: 'employees:create', columns: [
      { key: 'firstName', label: 'Nombres', required: true, description: 'Nombres del empleado', example: 'Ana María' },
      { key: 'lastName', label: 'Apellidos', required: true, description: 'Apellidos del empleado', example: 'Pérez Gómez' },
      { key: 'taxId', label: 'Documento', required: false, description: 'Documento de identidad', example: '1012345678' },
      { key: 'salary', label: 'Salario', required: true, description: 'Salario mensual, mayor o igual a cero', example: '2500000' },
      { key: 'hireDate', label: 'Fecha de contratación', required: true, description: 'Fecha AAAA-MM-DD', example: '2026-01-15' },
      { key: 'position', label: 'Cargo', required: true, description: 'Cargo o posición', example: 'Cajero' },
      { key: 'email', label: 'Correo', required: false, description: 'Correo laboral', example: 'ana@empresa.com' },
      { key: 'phone', label: 'Teléfono', required: false, description: 'Número de contacto', example: '+57 300 000 0000' },
      { key: 'status', label: 'Estado', required: false, description: 'ACTIVE, INACTIVE, ON_LEAVE o TERMINATED', example: EmployeeStatus.ACTIVE, enumValues: Object.values(EmployeeStatus) },
      { key: 'userEmail', label: 'Correo del usuario', required: false, description: 'Correo del usuario existente que se vinculará', example: 'usuario@empresa.com' },
    ],
  },
  products: {
    resource: 'products', title: 'Productos', permission: 'products:create', columns: [
      { key: 'name', label: 'Nombre', required: true, description: 'Nombre del producto', example: 'Torta de chocolate' },
      { key: 'description', label: 'Descripción', required: false, description: 'Descripción del producto', example: 'Porción individual' },
      { key: 'sku', label: 'SKU', required: false, description: 'Si se omite, se genera automáticamente', example: 'TOR-CHO-0001' },
      { key: 'barcode', label: 'Código de barras', required: false, description: 'EAN/UPC; si se omite, se genera desde el SKU', example: '7701234567890' },
      { key: 'salePrice', label: 'Precio de venta', required: true, description: 'Número mayor o igual a cero', example: '18000' },
      { key: 'costPrice', label: 'Precio de costo', required: false, description: 'Número mayor o igual a cero', example: '9000' },
      { key: 'categoryCode', label: 'Código de categoría', required: false, description: 'Código de tres caracteres de una categoría existente', example: 'POS' },
      { key: 'isPurchased', label: 'Se compra a proveedor', required: false, description: 'true o false', example: 'false', enumValues: ['true', 'false'] },
      { key: 'imageUrl', label: 'URL de imagen', required: false, description: 'URL de imagen', example: 'https://...' },
      { key: 'notes', label: 'Notas', required: false, description: 'Notas internas', example: 'Producto destacado' },
    ],
  },
  supplies: {
    resource: 'supplies', title: 'Insumos', permission: 'supplies:create', columns: [
      { key: 'name', label: 'Nombre', required: true, description: 'Nombre del insumo', example: 'Harina de trigo' },
      { key: 'description', label: 'Descripción', required: false, description: 'Descripción del insumo', example: 'Harina de trigo premium' },
      { key: 'unitOfMeasure', label: 'Unidad de medida', required: true, description: 'GRAM, MILLILITER o UNIT', example: UnitOfMeasure.GRAM, enumValues: Object.values(UnitOfMeasure) },
      { key: 'packageSize', label: 'Tamaño del empaque', required: true, description: 'Número mayor que cero', example: '1000' },
      { key: 'basePrice', label: 'Precio del empaque', required: true, description: 'Número mayor o igual a cero', example: '4500' },
      { key: 'notes', label: 'Notas', required: false, description: 'Notas internas', example: 'Proveedor principal' },
    ],
  },
  'product-categories': {
    resource: 'product-categories', title: 'Categorías de productos', permission: 'product_categories:create', columns: [
      { key: 'name', label: 'Nombre', required: true, description: 'Nombre de la categoría', example: 'Postres' },
      { key: 'code', label: 'Código', required: true, description: 'Tres caracteres alfanuméricos', example: 'POS' },
      { key: 'notes', label: 'Notas', required: false, description: 'Notas internas', example: 'Categoría de postres' },
    ],
  },
  'expense-categories': {
    resource: 'expense-categories', title: 'Categorías de gastos', permission: 'expense_categories:create', columns: [
      { key: 'name', label: 'Nombre', required: true, description: 'Nombre de la categoría', example: 'Servicios públicos' },
      { key: 'description', label: 'Descripción', required: false, description: 'Descripción de la categoría', example: 'Agua, energía e internet' },
    ],
  },
  'transaction-categories': {
    resource: 'transaction-categories', title: 'Categorías de transacciones', permission: 'transaction_categories:create', columns: [
      { key: 'name', label: 'Nombre', required: true, description: 'Nombre de la categoría', example: 'Ventas en efectivo' },
      { key: 'description', label: 'Descripción', required: false, description: 'Descripción de la categoría', example: 'Ingresos por ventas' },
      { key: 'type', label: 'Tipo', required: true, description: 'INCOME o EXPENSE', example: TransactionCategoryType.INCOME, enumValues: Object.values(TransactionCategoryType) },
    ],
  },
};

export function getImportDefinition(resource: string): ImportDefinition {
  const definition = IMPORT_DEFINITIONS[resource as ImportResource];
  if (!definition) throw new Error(`Unsupported import resource: ${resource}`);
  return definition;
}

