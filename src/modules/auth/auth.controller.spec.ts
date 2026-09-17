import { UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request, Response } from 'express';
import appConfig from '../../common/config/config.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController refresh cookies', () => {
  const refreshToken = jest.fn();
  const response = { cookie: jest.fn(), clearCookie: jest.fn() };
  const controller = new AuthController(
    { refreshToken } as unknown as AuthService,
    { app: { env: 'production' }, jwt: { refreshExpiresInMs: 604800000 } } as ConfigType<typeof appConfig>,
  );
  const refresh = (token?: string) => controller.refreshToken(
    { cookies: { refresh_token: token } } as Request,
    response as unknown as Response,
  );

  beforeEach(() => jest.resetAllMocks());

  it('clears both cookies when the refresh cookie is missing', async () => {
    await expect(refresh()).rejects.toThrow(UnauthorizedException);
    expect(response.clearCookie.mock.calls).toEqual([['access_token'], ['refresh_token']]);
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it('clears both cookies for an expired or revoked session', async () => {
    refreshToken.mockRejectedValue(new UnauthorizedException());
    await expect(refresh('stale')).rejects.toThrow(UnauthorizedException);
    expect(response.clearCookie.mock.calls).toEqual([['access_token'], ['refresh_token']]);
  });

  it('preserves cookies on infrastructure failures', async () => {
    const failure = new Error('database unavailable');
    refreshToken.mockRejectedValue(failure);
    await expect(refresh('valid')).rejects.toBe(failure);
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('sets rotated HttpOnly cookies without exposing tokens in the body', async () => {
    refreshToken.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', message: 'ok' });
    await expect(refresh('valid')).resolves.toEqual({ message: 'ok' });
    expect(response.cookie).toHaveBeenCalledWith('access_token', 'access', expect.objectContaining({ httpOnly: true, secure: true }));
    expect(response.cookie).toHaveBeenCalledWith('refresh_token', 'refresh', expect.objectContaining({ httpOnly: true, secure: true }));
    expect(response.clearCookie).not.toHaveBeenCalled();
  });
});
