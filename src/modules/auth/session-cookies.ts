import type { Response } from 'express';
import { SessionScope } from '@prisma/client';
import { sessionCookieNames } from './session.constants.js';

/**
 * The access cookie tracks the access token, which is short-lived regardless of
 * application; only the refresh cookie's lifetime differs between the two.
 */
const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;

interface SessionCookieOptions {
  secure: boolean;
  /** Matches the refresh token's own expiry for this application. */
  refreshMaxAgeMs: number;
}

/**
 * Writes one application's cookie pair. Both pairs live at the default
 * `Path=/` — see the note in session.constants.ts for why path scoping is not
 * an option here — so the names are what keep the dashboard and the console
 * apart in the browser's jar.
 */
export function setSessionCookies(
  response: Response,
  scope: SessionScope,
  accessToken: string,
  refreshToken: string,
  { secure, refreshMaxAgeMs }: SessionCookieOptions,
): void {
  const names = sessionCookieNames(scope);

  response.cookie(names.access, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: ACCESS_COOKIE_MAX_AGE_MS,
  });

  response.cookie(names.refresh, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: refreshMaxAgeMs,
  });
}

/** Clears one application's cookie pair, leaving the other's in place. */
export function clearSessionCookies(response: Response, scope: SessionScope): void {
  const names = sessionCookieNames(scope);
  response.clearCookie(names.access);
  response.clearCookie(names.refresh);
}
