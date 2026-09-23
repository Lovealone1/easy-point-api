import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientType, EmployeeStatus, Prisma, TransactionCategoryType, UnitOfMeasure } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { generateSku } from '../../common/utils/sku.util.js';
import { skuToEan13 } from '../../common/utils/barcode.util.js';
import { createTemplate, hashImportFile, parseImportFile } from './imports.parser.js';
import {
  getImportDefinition,
  ImportDefinition,
  ImportResource,
  ImportValidationError,
  ImportValidationResult,
  ParsedImportRow,
} from './imports.types.js';

type PreparedRow = Record<string, any> & { __row: number };

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalized(value: unknown): string {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const valueText = normalized(value);
  if (['true', '1', 'si', 'sí', 'yes'].includes(valueText)) return true;
  if (['false', '0', 'no'].includes(valueText)) return false;
  return null;
}

function enumValue<T extends string>(value: unknown, values: readonly T[]): T | null {
  const candidate = text(value).toUpperCase();
  return values.includes(candidate as T) ? candidate as T : null;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function error(row: number, column: string | undefined, code: string, message: string): ImportValidationError {
  return { row, column, code, message };
}

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  template(resource: string, format: 'xlsx' | 'csv') {
    return createTemplate(resource, format);
  }

  async validate(resource: string, file: Express.Multer.File): Promise<ImportValidationResult> {
    const parsed = parseImportFile(file.buffer, file.originalname, resource);
    const organizationId = this.requireTenant();
    const { rows, errors } = await this.prepare(resource as ImportResource, parsed.rows, organizationId);
    const preview = rows.slice(0, 20).map((row) => {
      const { __row, categoryId, userId, ...values } = row;
      return { ...values, __row };
    });
    return {
      valid: errors.length === 0,
      resource: resource as ImportResource,
      fileHash: parsed.fileHash,
      totalRows: parsed.rows.length,
      validRows: parsed.rows.length - new Set(errors.map((item) => item.row)).size,
      invalidRows: new Set(errors.map((item) => item.row)).size,
      preview,
      errors: errors.slice(0, 2000),
    };
  }

  async import(
    resource: string,
    file: Express.Multer.File,
    expectedHash: string | undefined,
    idempotencyKey: string | undefined,
    userId?: string,
  ): Promise<Record<string, unknown>> {
    const parsed = parseImportFile(file.buffer, file.originalname, resource);
    if (expectedHash && expectedHash !== parsed.fileHash) {
      throw new ConflictException('El archivo cambió desde la revisión; debe validarlo nuevamente');
    }
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      throw new BadRequestException('Debe enviar un encabezado x-idempotency-key válido');
    }
    const organizationId = this.requireTenant();
    const previous = await this.prisma.importRecord.findUnique({
      where: { organizationId_resource_idempotencyKey: { organizationId, resource, idempotencyKey } },
    });
    if (previous) {
      if (previous.fileHash !== parsed.fileHash) throw new ConflictException('La clave de idempotencia ya fue usada con otro archivo');
      return { ...(previous.result as Record<string, unknown>), idempotent: true };
    }
    const prepared = await this.prepare(resource as ImportResource, parsed.rows, organizationId);
    if (prepared.errors.length) {
      throw new BadRequestException({ message: 'El archivo contiene errores', errors: prepared.errors.slice(0, 2000), fileHash: parsed.fileHash });
    }
    const definition = getImportDefinition(resource);
    const result = await this.prisma.$tenantTransaction(async (tx) => {
      // Serialize imports for the same organization/resource. This closes the
      // race between duplicate validation and insertion for models without a
      // database uniqueness constraint.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId + ':' + resource}))`;
      const insideRecord = await tx.importRecord.findUnique({
        where: { organizationId_resource_idempotencyKey: { organizationId, resource, idempotencyKey } },
      });
      if (insideRecord) {
        if (insideRecord.fileHash !== parsed.fileHash) throw new ConflictException('La clave de idempotencia ya fue usada con otro archivo');
        return { ...(insideRecord.result as Record<string, unknown>), idempotent: true };
      }
      const fresh = await this.prepare(resource as ImportResource, parsed.rows, organizationId, tx);
      if (fresh.errors.length) {
        throw new BadRequestException({ message: 'El archivo dejó de ser válido desde la revisión', errors: fresh.errors.slice(0, 2000), fileHash: parsed.fileHash });
      }
      const createdRows = await this.createRows(tx, resource as ImportResource, fresh.rows, organizationId);
      const response = {
        resource,
        fileHash: parsed.fileHash,
        totalRows: parsed.rows.length,
        createdRows,
        idempotent: false,
      };
      await tx.importRecord.create({
        data: {
          organizationId,
          userId: userId ?? null,
          resource,
          fileHash: parsed.fileHash,
          idempotencyKey,
          totalRows: parsed.rows.length,
          createdRows,
          result: response,
        },
      });
      return response;
    }, { timeout: 60_000, maxWait: 10_000 });
    return result;
  }

  private requireTenant(): string {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing x-organization-id header');
    return organizationId;
  }

  private async prepare(resource: ImportResource, rows: ParsedImportRow[], organizationId: string, client?: Prisma.TransactionClient): Promise<{ rows: PreparedRow[]; errors: ImportValidationError[] }> {
    const db = client ?? this.prisma;
    const definition = getImportDefinition(resource);
    const errors: ImportValidationError[] = [];
    const prepared: PreparedRow[] = [];
    const categories = resource === 'products'
      ? await db.productCategory.findMany({ where: { organizationId } })
      : [];
    const users = resource === 'employees'
      ? await db.organizationUser.findMany({ where: { organizationId }, include: { user: { select: { id: true, email: true } } } })
      : [];
    const linkedEmployeeUserIds = resource === 'employees'
      ? new Set((await db.employee.findMany({ where: { organizationId, userId: { not: null } }, select: { userId: true } })).map((item) => item.userId).filter((id): id is string => !!id))
      : new Set<string>();

    const existing: string[] = [];
    if (resource === 'clients') {
      const records = await db.client.findMany({ where: { organizationId }, select: { name: true, taxId: true, phone: true } });
      existing.push(...records.map((item) => item.taxId ? `tax:${normalized(item.taxId)}` : `name:${normalized(item.name)}|phone:${normalized(item.phone)}`));
    } else if (resource === 'suppliers') {
      const records = await db.supplier.findMany({ where: { organizationId }, select: { taxId: true } });
      existing.push(...records.map((item) => `tax:${normalized(item.taxId)}`));
    } else if (resource === 'employees') {
      const records = await db.employee.findMany({ where: { organizationId }, select: { firstName: true, lastName: true, taxId: true, email: true } });
      existing.push(...records.map((item) => item.taxId ? `tax:${normalized(item.taxId)}` : `person:${normalized(`${item.firstName} ${item.lastName}`)}|email:${normalized(item.email)}`));
    } else if (resource === 'products') {
      const records = await db.product.findMany({ where: { organizationId }, select: { sku: true, name: true, categoryId: true } });
      existing.push(...records.map((item) => item.sku ? `sku:${normalized(item.sku)}` : `product:${normalized(item.name)}|category:${item.categoryId ?? ''}`));
    } else if (resource === 'supplies') {
      const records = await db.supply.findMany({ where: { organizationId }, select: { name: true, unitOfMeasure: true, packageSize: true } });
      existing.push(...records.map((item) => `supply:${normalized(item.name)}|unit:${item.unitOfMeasure}|size:${item.packageSize.toString()}`));
    } else if (resource === 'product-categories') {
      const records = await db.productCategory.findMany({ where: { organizationId }, select: { code: true } });
      existing.push(...records.map((item) => `code:${normalized(item.code)}`));
    } else if (resource === 'expense-categories') {
      const records = await db.expenseCategory.findMany({ where: { organizationId }, select: { name: true } });
      existing.push(...records.map((item) => `name:${normalized(item.name)}`));
    } else if (resource === 'transaction-categories') {
      const records = await db.transactionCategory.findMany({ where: { organizationId }, select: { name: true, type: true } });
      existing.push(...records.map((item) => `name:${normalized(item.name)}|type:${item.type}`));
    }
    const seen = new Set(existing);

    for (const row of rows) {
      const value = row.values;
      const current: PreparedRow = { __row: row.rowNumber };
      for (const column of definition.columns) {
        const raw = value[column.key];
        if (column.required && text(raw) === '') errors.push(error(row.rowNumber, column.key, 'REQUIRED', `El campo ${column.label} es obligatorio`));
        if (text(raw) !== '' && column.key.toLowerCase().includes('email') && !/^\S+@\S+\.\S+$/.test(text(raw))) errors.push(error(row.rowNumber, column.key, 'EMAIL', 'El correo no tiene un formato válido'));
        current[column.key] = typeof raw === 'string' ? raw.trim() : raw;
      }
      const addNumber = (key: string, minimum: number, integer = false) => {
        if (text(value[key]) === '') return;
        const parsed = numberValue(value[key]);
        if (parsed === null || parsed < minimum || (integer && !Number.isInteger(parsed))) errors.push(error(row.rowNumber, key, 'NUMBER', `El campo ${key} debe ser ${integer ? 'un entero ' : ''}mayor o igual a ${minimum}`));
        else current[key] = parsed;
      };
      if (resource === 'clients') {
        addNumber('creditLimit', 0);
        const typeValue = enumValue(value.clientType || ClientType.INDIVIDUAL, Object.values(ClientType));
        if (!typeValue) errors.push(error(row.rowNumber, 'clientType', 'ENUM', 'Tipo de cliente inválido')); else current.clientType = typeValue;
      } else if (resource === 'suppliers') addNumber('leadTime', 0, true);
      else if (resource === 'employees') {
        addNumber('salary', 0);
        const date = dateValue(value.hireDate);
        if (!date) errors.push(error(row.rowNumber, 'hireDate', 'DATE', 'La fecha debe tener formato AAAA-MM-DD')); else current.hireDate = date;
        const status = enumValue(value.status || EmployeeStatus.ACTIVE, Object.values(EmployeeStatus));
        if (!status) errors.push(error(row.rowNumber, 'status', 'ENUM', 'Estado de empleado inválido')); else current.status = status;
        if (text(value.userEmail)) {
          const linked = users.find((item) => normalized(item.user.email) === normalized(value.userEmail));
          if (!linked) errors.push(error(row.rowNumber, 'userEmail', 'REFERENCE', 'El usuario no existe dentro de esta organización'));
          else if (linkedEmployeeUserIds.has(linked.userId)) errors.push(error(row.rowNumber, 'userEmail', 'DUPLICATE', 'El usuario ya está vinculado a otro empleado'));
          else { current.userId = linked.userId; linkedEmployeeUserIds.add(linked.userId); }
        }
      } else if (resource === 'products') {
        addNumber('salePrice', 0);
        addNumber('costPrice', 0);
        const bool = text(value.isPurchased) === '' ? false : booleanValue(value.isPurchased);
        if (bool === null) errors.push(error(row.rowNumber, 'isPurchased', 'BOOLEAN', 'Use true o false')); else current.isPurchased = bool;
        if (text(value.categoryCode)) {
          const category = categories.find((item) => normalized(item.code) === normalized(value.categoryCode));
          if (!category) errors.push(error(row.rowNumber, 'categoryCode', 'REFERENCE', 'La categoría no existe dentro de esta organización'));
          else { current.categoryId = category.id; current.categoryCode = category.code; }
        } else current.categoryId = null;
      } else if (resource === 'supplies') {
        addNumber('packageSize', 0.0001);
        addNumber('basePrice', 0);
        const unit = enumValue(value.unitOfMeasure, Object.values(UnitOfMeasure));
        if (!unit) errors.push(error(row.rowNumber, 'unitOfMeasure', 'ENUM', 'Unidad de medida inválida')); else current.unitOfMeasure = unit;
      } else if (resource === 'product-categories') {
        const code = text(value.code).toUpperCase();
        if (!/^[A-Z0-9]{3}$/.test(code)) errors.push(error(row.rowNumber, 'code', 'FORMAT', 'El código debe tener tres caracteres alfanuméricos')); else current.code = code;
      } else if (resource === 'transaction-categories') {
        const type = enumValue(value.type, Object.values(TransactionCategoryType));
        if (!type) errors.push(error(row.rowNumber, 'type', 'ENUM', 'Tipo de transacción inválido')); else current.type = type;
      }
      const identity = this.identity(resource, current);
      if (identity && seen.has(identity)) errors.push(error(row.rowNumber, undefined, 'DUPLICATE', 'El registro ya existe o está repetido en el archivo'));
      if (identity) seen.add(identity);
      prepared.push(current);
    }
    return { rows: prepared, errors };
  }

  private identity(resource: ImportResource, row: PreparedRow): string | null {
    if (resource === 'clients') return text(row.taxId) ? `tax:${normalized(row.taxId)}` : `name:${normalized(row.name)}|phone:${normalized(row.phone)}`;
    if (resource === 'suppliers') return `tax:${normalized(row.taxId)}`;
    if (resource === 'employees') return text(row.taxId) ? `tax:${normalized(row.taxId)}` : `person:${normalized(`${row.firstName} ${row.lastName}`)}|email:${normalized(row.email)}`;
    if (resource === 'products') return text(row.sku) ? `sku:${normalized(row.sku)}` : `product:${normalized(row.name)}|category:${row.categoryId ?? ''}`;
    if (resource === 'supplies') return `supply:${normalized(row.name)}|unit:${row.unitOfMeasure}|size:${numberValue(row.packageSize)}`;
    if (resource === 'product-categories') return `code:${normalized(row.code)}`;
    if (resource === 'expense-categories') return `name:${normalized(row.name)}`;
    return `name:${normalized(row.name)}|type:${row.type}`;
  }

  private async createRows(tx: Prisma.TransactionClient, resource: ImportResource, rows: PreparedRow[], organizationId: string): Promise<number> {
    if (resource === 'clients') {
      for (const row of rows) await tx.client.create({ data: { organizationId, name: text(row.name), taxId: text(row.taxId) || null, email: text(row.email) || null, phone: text(row.phone), address: text(row.address) || null, creditLimit: new Prisma.Decimal(row.creditLimit), clientType: row.clientType ?? ClientType.INDIVIDUAL, notes: text(row.notes) || null } });
    } else if (resource === 'suppliers') {
      for (const row of rows) await tx.supplier.create({ data: { organizationId, name: text(row.name), taxId: text(row.taxId), email: text(row.email), phone: text(row.phone), address: text(row.address), bankAccount: text(row.bankAccount) || null, leadTime: row.leadTime, paymentTerms: text(row.paymentTerms) || null, notes: text(row.notes) || null } });
    } else if (resource === 'employees') {
      for (const row of rows) await tx.employee.create({ data: { organizationId, firstName: text(row.firstName), lastName: text(row.lastName), taxId: text(row.taxId) || null, salary: new Prisma.Decimal(row.salary), hireDate: row.hireDate, position: text(row.position), email: text(row.email) || null, phone: text(row.phone) || null, status: row.status ?? EmployeeStatus.ACTIVE, isActive: row.status !== EmployeeStatus.TERMINATED, userId: row.userId ?? null } });
    } else if (resource === 'product-categories') {
      for (const row of rows) await tx.productCategory.create({ data: { organizationId, name: text(row.name), code: text(row.code).toUpperCase(), notes: text(row.notes) || null } });
    } else if (resource === 'expense-categories') {
      for (const row of rows) await tx.expenseCategory.create({ data: { organizationId, name: text(row.name), description: text(row.description) || null } });
    } else if (resource === 'transaction-categories') {
      for (const row of rows) await tx.transactionCategory.create({ data: { organizationId, name: text(row.name), description: text(row.description) || null, type: row.type } });
    } else if (resource === 'supplies') {
      for (const row of rows) {
        const packageSize = new Prisma.Decimal(row.packageSize);
        const basePrice = new Prisma.Decimal(row.basePrice);
        const supply = await tx.supply.create({ data: { organizationId, name: text(row.name), description: text(row.description) || null, unitOfMeasure: row.unitOfMeasure, packageSize, basePrice, pricePerUnit: basePrice.div(packageSize), notes: text(row.notes) || null } });
        const stock = await tx.supplyStock.create({ data: { organizationId, supplyId: supply.id, location: 'Principal', quantity: 0, minQuantity: 0 } });
        await tx.supplyStockEntry.create({ data: { organizationId, supplyStockId: stock.id, initialQuantity: 0, remainingQuantity: 0, unitCost: supply.pricePerUnit, isExhausted: true } });
      }
    } else if (resource === 'products') {
      const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
      if (!organization) throw new NotFoundException('Organización no encontrada');
      const sequences = new Map<string, number>();
      for (const row of rows) {
        const categoryKey = row.categoryId ?? 'GEN';
        let sku = text(row.sku) || null;
        if (!sku) {
          if (!sequences.has(categoryKey)) sequences.set(categoryKey, await tx.product.count({ where: { organizationId, categoryId: row.categoryId ?? null } }) + 1);
          const next = sequences.get(categoryKey)!;
          sku = generateSku(organization.name, row.categoryCode ?? 'GEN', text(row.name), next);
          sequences.set(categoryKey, next + 1);
        }
        const barcode = text(row.barcode) || skuToEan13(sku);
        const product = await tx.product.create({ data: { organizationId, name: text(row.name), description: text(row.description) || null, sku, barcode, salePrice: new Prisma.Decimal(row.salePrice), costPrice: row.costPrice === null || row.costPrice === undefined || row.costPrice === '' ? null : new Prisma.Decimal(row.costPrice), categoryId: row.categoryId ?? null, isPurchased: row.isPurchased ?? false, imageUrl: text(row.imageUrl) || null, notes: text(row.notes) || null } });
        await tx.productStock.create({ data: { organizationId, productId: product.id, location: 'Principal', quantity: 0, minQuantity: 0 } });
      }
    }
    return rows.length;
  }
}
