import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GenerateOtpDto } from './generate-otp.dto.js';
import { VerifyOtpDto } from './verify-otp.dto.js';
import { AuthIntent } from '../enums/auth-intent.enum.js';

/**
 * The console intent is chosen by the server, never by the caller.
 *
 * Were it requestable here, anyone could have an "administration console
 * access" email sent to any address they named — walking past the eligibility
 * check in AuthService.generateAdminOtp that exists to prevent exactly that.
 */
describe('public auth intents', () => {
  const intentErrors = (dto: object) =>
    validateSync(dto).filter((error) => error.property === 'intent');

  it.each([AuthIntent.LOGIN, AuthIntent.REGISTER])('accepts %s when requesting a code', (intent) => {
    const dto = plainToInstance(GenerateOtpDto, { email: 'user@example.com', intent });

    expect(intentErrors(dto)).toHaveLength(0);
  });

  it('rejects ADMIN_LOGIN when requesting a code', () => {
    const dto = plainToInstance(GenerateOtpDto, {
      email: 'user@example.com',
      intent: AuthIntent.ADMIN_LOGIN,
    });

    expect(intentErrors(dto)).toHaveLength(1);
  });

  it('rejects ADMIN_LOGIN when verifying a code', () => {
    const dto = plainToInstance(VerifyOtpDto, {
      email: 'user@example.com',
      otp: '123456',
      intent: AuthIntent.ADMIN_LOGIN,
    });

    expect(intentErrors(dto)).toHaveLength(1);
  });
});
