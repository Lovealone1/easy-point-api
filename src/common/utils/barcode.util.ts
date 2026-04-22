import { createHash } from 'crypto';
import bwipjs from 'bwip-js';

/**
 * Barcode Utility
 *
 * Responsabilidades:
 *  - Derivar un código EAN-13 numérico determinístico desde un SKU alfanumérico.
 *  - Generar la imagen PNG del barcode usando bwip-js (para endpoints de descarga/preview).
 *
 * Formato EAN-13:
 *  - 12 dígitos de datos + 1 dígito de control (check digit).
 *  - Estándar global de retail (GS1), compatible con cualquier lector de códigos de barras.
 *
 * Estrategia de conversión SKU → 12 dígitos:
 *  - SHA-256 del SKU → se extraen solo los caracteres numéricos (0-9) del hash hexadecimal.
 *  - Se toman los primeros 12 dígitos (padding con ceros si es necesario).
 *  - Esto garantiza: determinismo, colisiones mínimas, longitud siempre correcta.
 */

// ---------------------------------------------------------------------------
// EAN-13 — número
// ---------------------------------------------------------------------------

/**
 * Calcula el dígito de control EAN-13 a partir de 12 dígitos de datos.
 *
 * Algoritmo GS1 estándar:
 *  - Suma las posiciones impares (×1) y pares (×3).
 *  - Dígito de control = (10 - (suma % 10)) % 10
 */
function ean13CheckDigit(digits12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * Convierte un SKU alfanumérico en un código EAN-13 de 13 dígitos.
 *
 * El resultado es:
 *  - Determinístico: mismo SKU → mismo EAN-13 siempre.
 *  - Único con alta probabilidad (SHA-256 base).
 *  - Válido: pasa la verificación estándar GS1.
 *
 * @param sku  SKU del producto, ej. "CRM-REP-CRV-0001"
 * @returns    EAN-13 de 13 dígitos, ej. "4729301847263"
 */
export function skuToEan13(sku: string): string {
  const hash = createHash('sha256').update(sku).digest('hex');
  // Extraer solo dígitos del hash hex y tomar los primeros 12
  const digits12 = hash
    .replace(/[^0-9]/g, '')
    .substring(0, 12)
    .padEnd(12, '0');
  return digits12 + ean13CheckDigit(digits12);
}

/**
 * Valida que un string de 13 dígitos es un EAN-13 correcto (check digit válido).
 *
 * @param ean13  String de 13 dígitos a validar.
 * @returns      true si el dígito de control es correcto.
 */
export function isValidEan13(ean13: string): boolean {
  if (!/^\d{13}$/.test(ean13)) return false;
  return ean13CheckDigit(ean13.substring(0, 12)) === ean13[12];
}

// ---------------------------------------------------------------------------
// EAN-13 — imagen PNG (para endpoints de preview/descarga)
// ---------------------------------------------------------------------------

/**
 * Genera un buffer PNG del barcode EAN-13 usando bwip-js.
 *
 * Uso típico: endpoint GET /products/:id/barcode → devuelve el PNG.
 *
 * @param ean13  Código EAN-13 de 13 dígitos (obtenido con skuToEan13).
 * @returns      Buffer PNG del barcode listo para enviar como respuesta HTTP.
 *
 * @example
 * const png = await generateEan13Png('4729301847263');
 * res.setHeader('Content-Type', 'image/png');
 * res.send(png);
 */
export async function generateEan13Png(ean13: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'ean13',
    text: ean13,
    scale: 3,
    height: 15,
    includetext: true,
    textxalign: 'center',
  });
}
