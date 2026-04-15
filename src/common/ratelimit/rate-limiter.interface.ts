export interface LimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfterMs: number;
}

export interface RateLimiter {
  allow(
    key: string,
  ): Promise<{ allowed: boolean; info: LimitInfo }>;
}
