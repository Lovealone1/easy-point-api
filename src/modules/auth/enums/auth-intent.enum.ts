export enum AuthIntent {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  /**
   * Signing into the administration console. A separate intent so the code
   * lives under its own Redis key: a dashboard code read aloud over the phone
   * must not also open the console.
   */
  ADMIN_LOGIN = 'ADMIN_LOGIN',
}

/**
 * The intents a client is allowed to name on the public dashboard routes.
 *
 * ADMIN_LOGIN is deliberately absent: it is set server-side by
 * AdminAuthController, which first checks the address may actually use the
 * console. Letting a caller ask for it here would route around that check.
 */
export const CLIENT_REQUESTABLE_INTENTS: AuthIntent[] = [
  AuthIntent.LOGIN,
  AuthIntent.REGISTER,
];
