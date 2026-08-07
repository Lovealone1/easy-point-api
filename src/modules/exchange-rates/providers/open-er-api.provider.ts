import { Logger } from '@nestjs/common';
import type { AppConfig } from '../../../common/config/config.js';
import type { FxProvider, FxRateTable } from './fx-provider.interface.js';

/**
 * Shape of the open.er-api.com v6 response. Only the fields we consume are
 * declared; the provider sends several more.
 */
interface OpenErApiResponse {
  result: 'success' | 'error';
  'error-type'?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_unix?: number;
  time_next_update_unix?: number;
}

/**
 * ExchangeRate-API's key-less Open Access endpoint. 161 currencies, refreshed
 * once a day, no authentication — in exchange their terms require attribution
 * wherever the rates are shown.
 */
export class OpenErApiProvider implements FxProvider {
  readonly name = 'open-er-api';
  readonly attribution = 'Rates By Exchange Rate API — https://www.exchangerate-api.com';

  private readonly logger = new Logger(OpenErApiProvider.name);

  constructor(private readonly config: AppConfig['fx']) {}

  async fetchLatest(base: string): Promise<FxRateTable> {
    const code = base.trim().toUpperCase();
    const url = `${this.config.baseUrl.replace(/\/$/, '')}/${code}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`FX provider responded ${response.status} ${response.statusText} for base ${code}`);
    }

    const body = (await response.json()) as OpenErApiResponse;

    if (body.result !== 'success') {
      throw new Error(`FX provider returned an error for base ${code}: ${body['error-type'] ?? 'unknown'}`);
    }

    if (!body.rates || Object.keys(body.rates).length === 0) {
      throw new Error(`FX provider returned no rates for base ${code}`);
    }

    this.logger.debug(`Fetched ${Object.keys(body.rates).length} rates for base ${code}`);

    return {
      base: body.base_code ?? code,
      rates: body.rates,
      ratesAsOf: body.time_last_update_unix ? new Date(body.time_last_update_unix * 1000) : new Date(),
      nextUpdateAt: body.time_next_update_unix ? new Date(body.time_next_update_unix * 1000) : null,
      provider: this.name,
      attribution: this.attribution,
    };
  }
}
