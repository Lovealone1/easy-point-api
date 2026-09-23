import XLSX from 'xlsx-js-style';
import { createTemplate, parseImportFile } from './imports.parser.js';

function workbookBuffer(rows: unknown[][]): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Datos');
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

describe('master import parser', () => {
  it('creates a styled workbook template with no data rows', () => {
    const template = createTemplate('clients', 'xlsx');
    expect(template.contentType).toContain('spreadsheetml');
    expect(() => parseImportFile(template.buffer, template.filename, 'clients')).toThrow('no contiene filas');
  });

  it('reads canonical headers and ignores blank rows', () => {
    const buffer = workbookBuffer([
      ['name', 'phone', 'creditLimit'],
      ['Ana Pérez', '3001234567', 0],
      ['', '', ''],
    ]);
    const parsed = parseImportFile(buffer, 'clients.xlsx', 'clients');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].values.name).toBe('Ana Pérez');
    expect(parsed.rows[0].rowNumber).toBe(2);
  });

  it('accepts optional labels in CSV headers', () => {
    const csv = Buffer.from('\ufeffname;phone;creditLimit (opcional)\r\nAna;300;0\r\n', 'utf8');
    const parsed = parseImportFile(csv, 'clients.csv', 'clients');
    expect(parsed.rows[0].values.creditLimit).toBe('0');
  });

  it('rejects unknown headers and formulas', () => {
    expect(() => parseImportFile(workbookBuffer([['name', 'unknown'], ['Ana', 'x']]), 'clients.xlsx', 'clients')).toThrow('Encabezados desconocidos');
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([['name', 'phone', 'creditLimit'], ['Ana', '300', 0]]);
    sheet.B2 = { t: 'n', f: '1+1', v: 2 };
    XLSX.utils.book_append_sheet(workbook, sheet, 'Datos');
    expect(() => parseImportFile(Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })), 'clients.xlsx', 'clients')).toThrow('fórmulas');
  });
});

