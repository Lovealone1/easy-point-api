/**
 * Internal event bus token for the audit system.
 * Used with @nestjs/event-emitter to decouple audit emission from persistence.
 */
export const AUDIT_LOG_EVENT = 'audit.log' as const;
