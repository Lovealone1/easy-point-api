import { sanitize, sanitizePayload } from './audit.sanitizer';

describe('AuditSanitizer', () => {
  describe('sanitize()', () => {
    it('redacts password fields', () => {
      const input = { email: 'test@example.com', password: 'supersecret123' };
      const result = sanitize(input) as Record<string, unknown>;
      expect(result['email']).toBe('test@example.com');
      expect(result['password']).toBe('[REDACTED]');
    });

    it('redacts token fields', () => {
      const input = {
        accessToken: 'jwt.token.here',
        refreshToken: 'refresh.token.here',
        data: 'safe',
      };
      const result = sanitize(input) as Record<string, unknown>;
      expect(result['accessToken']).toBe('[REDACTED]');
      expect(result['refreshToken']).toBe('[REDACTED]');
      expect(result['data']).toBe('safe');
    });

    it('redacts nested sensitive fields', () => {
      const input = {
        user: {
          email: 'user@example.com',
          secret: 'my-api-secret',
          profile: { name: 'Alice', apiKey: 'key_123' },
        },
      };
      const result = sanitize(input) as any;
      expect(result.user.email).toBe('user@example.com');
      expect(result.user.secret).toBe('[REDACTED]');
      expect(result.user.profile.name).toBe('Alice');
      expect(result.user.profile.apiKey).toBe('[REDACTED]');
    });

    it('handles arrays of objects', () => {
      const input = [
        { id: '1', password: 'secret1' },
        { id: '2', password: 'secret2' },
      ];
      const result = sanitize(input) as any[];
      expect(result[0].id).toBe('1');
      expect(result[0].password).toBe('[REDACTED]');
      expect(result[1].password).toBe('[REDACTED]');
    });

    it('passes through null values', () => {
      expect(sanitize(null)).toBeNull();
      expect(sanitize(undefined)).toBeUndefined();
    });

    it('passes through primitives unchanged', () => {
      expect(sanitize('hello')).toBe('hello');
      expect(sanitize(42)).toBe(42);
      expect(sanitize(true)).toBe(true);
    });

    it('handles empty objects', () => {
      expect(sanitize({})).toEqual({});
    });

    it('does not mutate the original object', () => {
      const original = { password: 'secret', name: 'test' };
      sanitize(original);
      expect(original.password).toBe('secret');
    });

    it('redacts otp and verification code fields', () => {
      const input = { email: 'u@e.com', otp: '123456', verificationCode: '654321' };
      const result = sanitize(input) as any;
      expect(result.otp).toBe('[REDACTED]');
      expect(result.verificationCode).toBe('[REDACTED]');
    });

    it('redacts authorization headers', () => {
      const input = { authorization: 'Bearer tok', cookie: 'session=abc' };
      const result = sanitize(input) as any;
      expect(result.authorization).toBe('[REDACTED]');
      expect(result.cookie).toBe('[REDACTED]');
    });
  });

  describe('sanitizePayload()', () => {
    it('truncates strings exceeding maxStringLength', () => {
      const longString = 'a'.repeat(3000);
      const result = sanitizePayload({ field: longString }, 2000) as any;
      expect(result.field).toContain('[TRUNCATED]');
      expect(result.field.length).toBeLessThan(3000);
    });

    it('does not truncate strings within limit', () => {
      const result = sanitizePayload({ field: 'hello world' }, 2000) as any;
      expect(result.field).toBe('hello world');
    });

    it('sanitizes and truncates together', () => {
      const input = { password: 'secret', longField: 'x'.repeat(3000), safeName: 'Alice' };
      const result = sanitizePayload(input, 2000) as any;
      expect(result.password).toBe('[REDACTED]');
      expect(result.longField).toContain('[TRUNCATED]');
      expect(result.safeName).toBe('Alice');
    });
  });
});
