import type { RateLimiter } from './rate-limiter.interface.js';

export interface RateLimiters {
  global: RateLimiter | null;
  strictIp: RateLimiter | null;
  moderateIp: RateLimiter | null;
  readOps: RateLimiter | null;
  writeOps: RateLimiter | null;
}
