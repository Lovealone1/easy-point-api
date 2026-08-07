import { OpenErApiProvider } from './open-er-api.provider.js';
import type { AppConfig } from '../../../common/config/config.js';

const config: AppConfig['fx'] = {
  provider: 'open-er-api',
  baseUrl: 'https://open.er-api.com/v6/latest',
  apiKey: '',
  baseCurrency: 'USD',
  cacheTtlSeconds: 86_400,
  requestTimeoutMs: 5_000,
  enabled: true,
};

const SUCCESS_BODY = {
  result: 'success',
  base_code: 'USD',
  rates: { USD: 1, COP: 4012.5, EUR: 0.92 },
  time_last_update_unix: 1_785_974_401,
  time_next_update_unix: 1_786_060_801,
};

describe('OpenErApiProvider', () => {
  let provider: OpenErApiProvider;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    provider = new OpenErApiProvider(config);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function respond(body: unknown, ok = true, status = 200) {
    fetchMock.mockResolvedValueOnce({ ok, status, statusText: 'OK', json: async () => body });
  }

  it('maps a successful response onto the rate table', async () => {
    respond(SUCCESS_BODY);

    const table = await provider.fetchLatest('USD');

    expect(table.base).toBe('USD');
    expect(table.rates.COP).toBe(4012.5);
    expect(table.ratesAsOf).toEqual(new Date(1_785_974_401 * 1000));
    expect(table.nextUpdateAt).toEqual(new Date(1_786_060_801 * 1000));
    expect(table.provider).toBe('open-er-api');
    expect(table.attribution).toContain('exchangerate-api.com');
  });

  it('normalizes the currency code into the URL', async () => {
    respond(SUCCESS_BODY);

    await provider.fetchLatest(' cop ');

    expect(fetchMock.mock.calls[0][0]).toBe('https://open.er-api.com/v6/latest/COP');
  });

  it('throws on a non-2xx response', async () => {
    respond({}, false, 503);
    await expect(provider.fetchLatest('USD')).rejects.toThrow(/503/);
  });

  it('throws when the provider reports a logical error', async () => {
    respond({ result: 'error', 'error-type': 'unsupported-code' });
    await expect(provider.fetchLatest('XXX')).rejects.toThrow(/unsupported-code/);
  });

  it('throws when the payload carries no rates', async () => {
    respond({ result: 'success', base_code: 'USD', rates: {} });
    await expect(provider.fetchLatest('USD')).rejects.toThrow(/no rates/);
  });

  it('propagates a timeout so the caller can fall back', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted', 'TimeoutError'));
    await expect(provider.fetchLatest('USD')).rejects.toThrow();
  });

  it('propagates malformed JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    });

    await expect(provider.fetchLatest('USD')).rejects.toThrow(SyntaxError);
  });

  it('falls back to now when the provider omits its timestamp', async () => {
    respond({ result: 'success', base_code: 'USD', rates: { COP: 4012.5 } });

    const table = await provider.fetchLatest('USD');

    expect(table.ratesAsOf).toBeInstanceOf(Date);
    expect(table.nextUpdateAt).toBeNull();
  });
});
