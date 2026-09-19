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
