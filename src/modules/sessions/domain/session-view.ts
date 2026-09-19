import { SessionScope } from '@prisma/client';
import type { SessionMetadata } from '../../auth/session.constants.js';
import { describeUserAgent, type DeviceDescription } from './user-agent.js';

/**
 * One row of "where am I signed in".
 *
 * Every field that existed on the raw Redis blob keeps its original name and
 * type — `expiresAt` in particular stays Unix seconds rather than becoming an
 * ISO string, because `GET /auth/sessions` already returns it that way and the
 * dashboard reads it. Everything else here is additive.
 */
export interface SessionView {
  sid: string;
  /** Which application the session belongs to. */
  scope: SessionScope;
  /** True for the session that issued the request being served. */
  current: boolean;
  ip: string;
  /** The raw header, kept so support can see what the parser could not. */
  userAgent: string;
  device: DeviceDescription;
  createdAt: string;
  /**
   * Last authenticated request on this session, to a five-minute resolution.
   * Falls back to `createdAt` for sessions minted before it was recorded.
   */
  lastSeenAt: string;
  /** Unix seconds. */
  expiresAt: number;
}

export function toSessionView(
  metadata: SessionMetadata,
  scope: SessionScope,
  currentSid?: string,
): SessionView {
  return {
    sid: metadata.sid,
    scope,
    current: currentSid !== undefined && metadata.sid === currentSid,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    device: describeUserAgent(metadata.userAgent),
    createdAt: metadata.createdAt,
    lastSeenAt: metadata.lastSeenAt ?? metadata.createdAt,
    expiresAt: metadata.expiresAt,
  };
}

/** Most recently used first — the order a person scanning the list expects. */
export function byMostRecentlyUsed(a: SessionView, b: SessionView): number {
  return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
}
