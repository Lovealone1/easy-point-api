/**
 * TypeScript mirror of the Prisma `AuditSeverity` enum.
 * Keep in sync with prisma/schema.prisma.
 *
 * Severity guide:
 *  LOW      — read-only / informational events (LIST, GET)
 *  MEDIUM   — standard write operations (CREATE, UPDATE)
 *  HIGH     — business-critical mutations (DELETE, CANCEL, ROLE_CHANGE)
 *  CRITICAL — security events (LOGIN_FAILED, SESSION_KILL, API_KEY_CHANGE)
 */
export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}
