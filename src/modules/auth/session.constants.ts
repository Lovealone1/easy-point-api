import { SessionScope } from '@prisma/client';

/**
 * Everything that has to differ between the two applications so their sessions
 * never touch: cookie names, Redis key namespaces, and the OTP channel.
 *
 * The dashboard keeps the original cookie names so existing clients and the
 * BFF keep working unchanged; the console gets its own pair.
 *
 * Both pairs are issued at `Path=/` rather than `/admin`. The browser never
 * talks to this API directly — it goes through the Next.js BFF, whose routes
 * live under `/api`, so a cookie scoped to `/admin` would never be attached to
 * the request that actually needs it. Isolation comes from the distinct names
 * plus the scope baked into the token, not from the path.
 */
interface SessionCookieNames {
  access: string;
  refresh: string;
}

const COOKIE_NAMES: Record<SessionScope, SessionCookieNames> = {
  [SessionScope.TENANT]: { access: 'access_token', refresh: 'refresh_token' },
  [SessionScope.ADMIN]: { access: 'admin_access_token', refresh: 'admin_refresh_token' },
};

export function sessionCookieNames(scope: SessionScope): SessionCookieNames {
  return COOKIE_NAMES[scope];
}

/** Every access-token cookie name, most privileged first. */
export const ACCESS_COOKIE_NAMES: readonly string[] = [
  COOKIE_NAMES[SessionScope.ADMIN].access,
  COOKIE_NAMES[SessionScope.TENANT].access,
];

/**
 * Redis key for a single live session. The scope is part of the key, so the
 * same user signed into both applications holds two independent entries and
 * revoking one cannot reach the other.
 */
export function sessionMetadataKey(scope: SessionScope, userId: string, sid: string): string {
  return `session_metadata:${scope}:${userId}:${sid}`;
}

/** Redis set holding a user's live session ids within one application. */
export function userSessionsKey(scope: SessionScope, userId: string): string {
  return `user_sessions:${scope}:${userId}`;
}

/**
 * Rate-limit namespace for OTP issuance. Signing into the console is a
 * separate act from signing into the dashboard, so the two flows get their own
 * cooldown and hourly budget instead of locking each other out.
 */
function otpChannel(scope: SessionScope): string {
  return scope === SessionScope.ADMIN ? 'admin' : 'tenant';
}

/** Blocks a second code from being sent within the cooldown window. */
export function otpCooldownKey(scope: SessionScope, email: string): string {
  return `otp:cooldown:${otpChannel(scope)}:${email}`;
}

/**
 * The hourly budget of codes for one address.
 *
 * Built here rather than inline because it is both charged (on issuance) and
 * refunded (on a correct code), and the two must agree on the key down to the
 * channel or a refund would silently miss.
 */
export function otpHourlyCountKey(scope: SessionScope, email: string): string {
  return `otp:hourly_count:${otpChannel(scope)}:${email}`;
}

/**
 * Returned whenever an OTP was valid but the account may not enter the
 * console — whether because no such user exists or because they are not a
 * global admin. Deliberately identical in both cases: the console must not
 * become an oracle for which addresses hold admin rights.
 */
export const ADMIN_ACCESS_DENIED =
  'This account is not authorized to access the administration console';
