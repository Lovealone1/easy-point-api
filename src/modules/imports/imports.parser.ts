import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as XLSX from 'xlsx-js-style';
import { getImportDefinition, ImportDefinition, ImportValue, ParsedImportRow } from './imports.types.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 1000;
const OPTIONAL_HEADER = '(opcional)';

export function hashImportFile(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\(opcional\)/g, '').replace(/[^a-z0-9]/g, '');
}

function parseDate(value: unknown): string | number | Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return value;
  return String(value).trim();
}

export function parseImportFile(buffer: Buffer, filename: string, resource: string): {
  definition: ImportDefinition;
  rows: ParsedImportRow[];
  fileHash: string;
} {
  if (!buffer?.length) throw new BadRequestException('El archivo está vacío');
  if (buffer.length > MAX_FILE_BYTES) throw new BadRequestException('El archivo supera el límite de 10 MB');
  const extension = filename.toLowerCase().split('.').pop();
  if (extension !== 'csv' && extension !== 'xlsx') {
    throw new BadRequestException('Solo se admiten archivos .csv y .xlsx');
  }
  const definition = getImportDefinition(resource);
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellFormula: true, raw: true });
  } catch {
    throw new BadRequestException('No se pudo leer el archivo');
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new BadRequestException('El archivo no contiene una hoja de datos');

  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  if (range.e.r - range.s.r > MAX_ROWS + 1) throw new BadRequestException('El archivo supera el límite de 1.000 filas');
  const headerValues = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: range.s.r, raw: true, defval: '' })[0] ?? [];
  const headerMap = new Map<string, string>();
  for (const column of definition.columns) {
    headerMap.set(normalizeHeader(column.key), column.key);
    headerMap.set(normalizeHeader(column.label), column.key);
    for (const alias of column.aliases ?? []) headerMap.set(normalizeHeader(alias), column.key);
  }
  const keys = (headerValues as unknown[]).map((value) => headerMap.get(normalizeHeader(value)) ?? null);
  const unknownHeaders = (headerValues as unknown[]).filter((value, index) => textHeader(value) && !keys[index]);
  if (unknownHeaders.length) throw new BadRequestException(`Encabezados desconocidos: ${unknownHeaders.map((value) => String(value)).join(', ')}`);
  if (!keys.length || keys.every((key) => !key)) throw new BadRequestException('La primera fila no contiene encabezados válidos');
  const seen = new Set<string>();
  const duplicates = keys.filter((key): key is string => !!key).filter((key) => seen.has(key) || !seen.add(key));
  if (duplicates.length) throw new BadRequestException(`Encabezados repetidos: ${[...new Set(duplicates)].join(', ')}`);

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: { s: { r: range.s.r + 1, c: range.s.c }, e: range.e }, raw: true, defval: '' });
  const rows: ParsedImportRow[] = [];
  rawRows.forEach((raw, index) => {
    const values: Record<string, ImportValue> = {};
    keys.forEach((key, columnIndex) => {
      const rawValue = raw[columnIndex];
      if (typeof rawValue === 'string' && rawValue.trimStart().startsWith('=')) {
        throw new BadRequestException(`No se permiten fórmulas en la fila ${index + range.s.r + 2}`);
      }
      if (key) values[key] = key.toLowerCase().includes('date') || key === 'hireDate' ? parseDate(rawValue) : (rawValue as ImportValue);
    });
    if (Object.values(values).some((value) => value !== '' && value !== null && value !== undefined)) {
      rows.push({ rowNumber: index + range.s.r + 2, values });
    }
  });
  if (!rows.length) throw new BadRequestException('El archivo no contiene filas de datos');
  if (rows.length > MAX_ROWS) throw new BadRequestException('El archivo supera el límite de 1.000 filas');
  // Reject formulas in data cells. Formula fields are intentionally not accepted for imports.
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    for (let column = range.s.c; column <= range.e.c; column++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell?.f) throw new BadRequestException(`No se permiten fórmulas en la fila ${row + 1}`);
    }
  }
  return { definition, rows, fileHash: hashImportFile(buffer) };
}

function textHeader(value: unknown): boolean {
  return String(value ?? '').trim().length > 0;
}

function csvEscape(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function createTemplate(resource: string, format: 'xlsx' | 'csv'): { buffer: Buffer; filename: string; contentType: string } {
  const definition = getImportDefinition(resource);
  const headers = definition.columns.map((column) => `${column.key}${column.required ? '' : ` ${OPTIONAL_HEADER}`}`);
  const example = definition.columns.map((column) => column.example ?? '');
  const hash = Date.now().toString(36);
  if (format === 'csv') {
    const body = [headers].map((row) => row.map(csvEscape).join(';')).join('\r\n') + '\r\n';
    return { buffer: Buffer.from('\ufeff' + body, 'utf8'), filename: `${resource}-plantilla-${hash}.csv`, contentType: 'text/csv; charset=utf-8' };
  }
  const workbook = XLSX.utils.book_new();
  // Keep the data sheet empty after its header row. Examples live in the
  // instructions sheet so a downloaded template can be uploaded safely.
  const rows = [headers];
  const dataSheet = XLSX.utils.aoa_to_sheet(rows);
  dataSheet['!cols'] = definition.columns.map(() => ({ wch: 22 }));
  definition.columns.forEach((column, index) => {
    const cell = dataSheet[XLSX.utils.encode_cell({ r: 0, c: index })];
    if (cell) cell.s = { fill: { fgColor: { rgb: column.required ? 'D9EAD3' : 'FFF2CC' } }, font: { bold: true, color: { rgb: '1F2937' } } };
  });
  const instructions = [
    ['Plantilla de importación', definition.title],
    ['Uso', 'Complete la hoja Datos y elimine la fila de ejemplo antes de cargar el archivo.'],
    ['Campos obligatorios', 'Verde'],
    ['Campos opcionales', 'Amarillo; puede dejarlos vacíos'],
    ...definition.columns.map((column) => [column.key, `${column.required ? 'Obligatorio' : 'Opcional'} — ${column.description}`, `Ejemplo: ${column.example ?? ''}`]),
  ];
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Datos');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(instructions), 'Instrucciones');
  return { buffer: Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })), filename: `${resource}-plantilla-${hash}.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}
