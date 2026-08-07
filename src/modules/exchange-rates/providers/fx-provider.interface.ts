/** DI token for the configured FX provider implementation. */
export const FX_PROVIDER = Symbol('FX_PROVIDER');

export interface FxRateTable {
  /** ISO 4217 code every rate in `rates` is quoted against. */
  base: string;
  /** code -> units of that currency per 1 unit of `base`. */
  rates: Record<string, number>;
  /** When the provider last refreshed these rates. */
  ratesAsOf: Date;
  /** When the provider expects to publish the next refresh, if it says. */
  nextUpdateAt: Date | null;
  provider: string;
  attribution: string;
}

export interface FxProvider {
  readonly name: string;
  /** Attribution string the provider's terms require us to surface. */
  readonly attribution: string;
  /** Fetches the latest rates. Throws on any failure; callers handle fallback. */
  fetchLatest(base: string): Promise<FxRateTable>;
}
