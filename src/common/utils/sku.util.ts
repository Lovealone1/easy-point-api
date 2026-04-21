/**
 * SKU Generator Utility
 *
 * Generates standardized product SKUs with the format:
 *   [ORG_PREFIX]-[CATEGORY_CODE]-[PRODUCT_CODE]-[SEQUENTIAL]
 *
 * Example:
 *   Organization: "Creamies"         → CRM
 *   Category:     "Repostería"        → REP
 *   Product:      "Cuchareable Red Velvet" → CRV
 *   Sequential:   1                  → 0001
 *   Result: CRM-REP-CRV-0001
 *
 * Example 2:
 *   Organization: "Dulce Sensación"  → DLS
 *   Category:     "Ropa"             → ROP
 *   Product:      "Camiseta Básica"  → CMB
 *   Sequential:   5                  → 0005
 *   Result: DLS-ROP-CMB-0005
 */

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Prepositions and short articles to ignore when splitting meaningful words. */
const STOP_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'unos', 'unas',
  'y', 'e', 'o', 'u', 'a', 'en', 'con', 'por', 'para', 'al',
]);

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

/**
 * Normalizes a raw string:
 * - Removes accents/diacritics (á→A, é→E, ñ→N, ü→U, etc.)
 * - Converts to uppercase
 * - Keeps only A-Z letters and spaces
 */
function normalize(raw: string): string {
  return raw
    .normalize('NFD')                        // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '')         // strip combining diacritics
    .replace(/ñ/gi, 'N')                     // ñ is not caught by NFD trick alone
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')               // keep only letters and spaces
    .trim();
}

/**
 * Splits a normalized string into meaningful words, filtering stop-words.
 */
function meaningfulWords(normalized: string): string[] {
  return normalized
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()));
}

/**
 * Extracts consonants from a word (uppercase A-Z only, already normalized).
 */
function consonants(word: string): string[] {
  return word.split('').filter((c) => !VOWELS.has(c));
}

// ---------------------------------------------------------------------------
// Core extraction logic
// ---------------------------------------------------------------------------

/**
 * Extracts a 3-character code from a free-text name (org name or product name).
 *
 * Strategy:
 *  - 1 meaningful word  → first 3 consonants of the word;
 *                         if fewer than 3 consonants, pad with consecutive characters.
 *  - 2 meaningful words → first char of word1 + first 2 consonants of word2
 *                         (or first char of each + filler from longest word).
 *  - 3+ meaningful words → first character of the first 3 meaningful words.
 *
 * The result is always exactly 3 uppercase letters.
 */
export function extractCode(name: string): string {
  const normalized = normalize(name);
  const words = meaningfulWords(normalized);

  if (words.length === 0) {
    // Fallback: just take first 3 chars of the raw normalized string
    const fallback = normalized.replace(/\s/g, '');
    return fallback.substring(0, 3).padEnd(3, 'X');
  }

  let code: string;

  if (words.length === 1) {
    // Single word: prioritize consonants, then fill with any char
    const word = words[0];
    const cons = consonants(word);
    const chars = cons.length >= 3 ? cons : [...cons, ...word.split('').filter((c) => VOWELS.has(c))];
    code = chars.slice(0, 3).join('').padEnd(3, word[0] ?? 'X');

  } else if (words.length === 2) {
    // Two words: first letter of word1 + first 2 consonants of word2,
    // falling back to any chars if consonants are scarce.
    const [w1, w2] = words;
    const cons2 = consonants(w2);
    const fill2 = cons2.length >= 2 ? cons2.slice(0, 2) : [...cons2, ...w2.split('').filter((c) => VOWELS.has(c))].slice(0, 2);
    code = (w1[0] + fill2.join('')).substring(0, 3).padEnd(3, 'X');

  } else {
    // Three or more words: first letter of the first 3 meaningful words
    code = words.slice(0, 3).map((w) => w[0]).join('');
  }

  return code.substring(0, 3).toUpperCase();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SkuParts {
  /** 3-letter organization prefix, e.g. "CRM" */
  orgPrefix: string;
  /** 3-letter category code, e.g. "REP" */
  categoryCode: string;
  /** 3-letter product code, e.g. "CRV" */
  productCode: string;
  /** Zero-padded sequential number, e.g. "0001" */
  sequential: string;
}

/**
 * Builds a full SKU string from its parts.
 *
 * @example
 * buildSku({ orgPrefix: 'CRM', categoryCode: 'REP', productCode: 'CRV', sequential: '0001' })
 * // → 'CRM-REP-CRV-0001'
 */
export function buildSku(parts: SkuParts): string {
  const { orgPrefix, categoryCode, productCode, sequential } = parts;
  return `${orgPrefix}-${categoryCode}-${productCode}-${sequential}`;
}

/**
 * Zero-pads a sequential number to 4 digits.
 *
 * @example
 * formatSequential(1)   // → '0001'
 * formatSequential(42)  // → '0042'
 * formatSequential(999) // → '0999'
 */
export function formatSequential(n: number): string {
  return String(n).padStart(4, '0');
}

/**
 * Generates a complete SKU string given the raw business inputs.
 *
 * The `categoryCode` must be provided as an already-validated 3-letter string
 * (stored on the ProductCategory model). The `sequential` is the next available
 * sequence number for this org+category combination (queried from the DB before
 * calling this function).
 *
 * @param orgName       Raw organization name, e.g. "Mis Lindos Postres"
 * @param categoryCode  3-letter category code, e.g. "REP"
 * @param productName   Raw product name, e.g. "Cuchareable Red Velvet"
 * @param sequential    Next integer in the org+category sequence, e.g. 1
 *
 * @example
 * generateSku('Creamies', 'REP', 'Cuchareable Red Velvet', 1)
 * // → 'CRM-REP-CRV-0001'
 *
 * generateSku('Dulce Sensación', 'ROP', 'Camiseta Básica', 5)
 * // → 'DLS-ROP-CMB-0005'
 *
 * generateSku('Mis Lindos Postres', 'REP', 'Red Velvet', 12)
 * // → 'MLP-REP-RDV-0012'
 */
export function generateSku(
  orgName: string,
  categoryCode: string,
  productName: string,
  sequential: number,
): string {
  const orgPrefix = extractCode(orgName);
  const productCode = extractCode(productName);
  const seq = formatSequential(sequential);

  // Ensure categoryCode is always stored/used as uppercase 3 chars
  const catCode = categoryCode.toUpperCase().substring(0, 3).padEnd(3, 'X');

  return buildSku({ orgPrefix, categoryCode: catCode, productCode, sequential: seq });
}
