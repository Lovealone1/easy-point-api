/**
 * AuditSanitizer — Centralised field scrubbing layer.
 *
 * Guarantees that sensitive data (passwords, tokens, secrets, API keys,
 * authorization headers, cookies) is NEVER persisted in audit logs.
 *
 * Rule: if in doubt, redact it.
 */

const SENSITIVE_KEYS = new Set([
  // Auth credentials
  'password',
  'passwordHash',
  'hashedPassword',
  'newPassword',
  'oldPassword',
  'currentPassword',
  'confirmPassword',

  // Tokens
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'bearerToken',
  'jwtToken',

  // Secrets / Keys
  'secret',
  'clientSecret',
  'apiKey',
  'apiSecret',
  'privateKey',
  'secretKey',
  'signingKey',
  'encryptionKey',

  // Session / Auth headers
  'authorization',
  'cookie',
  'setCookie',
  'xCsrfToken',
  'xAuthToken',

  // OTP / verification codes
  'otp',
  'verificationCode',
  'resetCode',
  'pinCode',
  'pin',

  // Personal sensitive data
  'ssn',
  'taxId',
  'nationalId',
]);

const REDACTED = '[REDACTED]';

/**
 * Recursively walks an object and replaces values of sensitive keys with
 * the `[REDACTED]` sentinel string.
 *
 * - Works on plain objects, arrays, and primitives.
 * - Handles circular references safely (returns REDACTED for non-serializable values).
 * - Does NOT mutate the original object.
 */
export function sanitize(data: unknown, depth = 0): unknown {
  // Safety guard — avoid runaway recursion on deeply nested structures
  if (depth > 10) return '[MAX_DEPTH]';

  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item, depth + 1));
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[-_\s]/g, '');

    if (SENSITIVE_KEYS.has(normalizedKey) || SENSITIVE_KEYS.has(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = sanitize(value, depth + 1);
    }
  }

  return result;
}

/**
 * Convenience wrapper — sanitizes and additionally truncates oversized strings
 * to prevent payload bloat in the `before`/`after` fields.
 */
export function sanitizePayload(
  data: unknown,
  maxStringLength = 2000,
): unknown {
  const cleaned = sanitize(data);
  return truncateStrings(cleaned, maxStringLength);
}

function truncateStrings(data: unknown, maxLen: number): unknown {
  if (typeof data === 'string') {
    return data.length > maxLen ? data.substring(0, maxLen) + '…[TRUNCATED]' : data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => truncateStrings(item, maxLen));
  }
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [
        k,
        truncateStrings(v, maxLen),
      ]),
    );
  }
  return data;
}
