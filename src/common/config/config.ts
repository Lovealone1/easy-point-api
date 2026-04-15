import { registerAs } from '@nestjs/config';

const MILLISECONDS_IN_SECOND = 1000;
const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/i;

type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd';

const DURATION_MULTIPLIERS: Record<DurationUnit, number> = {
  ms: 1,
  s: MILLISECONDS_IN_SECOND,
  m: 60 * MILLISECONDS_IN_SECOND,
  h: 60 * 60 * MILLISECONDS_IN_SECOND,
  d: 24 * 60 * 60 * MILLISECONDS_IN_SECOND,
};

export interface RateLimitTierConfig {
  requestsPerWindow: number;
  windowMs: number;
}

interface AppConfigShape {
  app: {
    env: string;
    port: number;
    apiBaseUrl: string;
    frontendUrl: string;
  };
  database: {
    url: string;
    directUrl: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
    projectRef: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  };
  redis: {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
    db: number;
    ttlSeconds: number;
    keyPrefix: string;
  };
  rateLimit: {
    enabled: boolean;
    global: RateLimitTierConfig;
    strictIp: RateLimitTierConfig;
    moderateIp: RateLimitTierConfig;
    readOps: RateLimitTierConfig;
    writeOps: RateLimitTierConfig;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
}

function getString(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function getNumber(key: string, fallback: number): number {
  const rawValue = process.env[key];

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function getBoolean(key: string, fallback: boolean): boolean {
  const rawValue = process.env[key];

  if (!rawValue) {
    return fallback;
  }

  const normalizedValue = rawValue.trim().toLowerCase();

  if (['true', '1', 'yes', 'y', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'n', 'off'].includes(normalizedValue)) {
    return false;
  }

  return fallback;
}

function getDurationMs(key: string, fallbackMs: number): number {
  const rawValue = process.env[key];

  if (!rawValue) {
    return fallbackMs;
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  const match = normalizedValue.match(DURATION_PATTERN);

  if (!match) {
    return fallbackMs;
  }

  const [, amount, unit] = match;
  return Number(amount) * DURATION_MULTIPLIERS[unit as DurationUnit];
}

function buildRateLimitTier(
  requestsKey: string,
  requestsFallback: number,
  windowKey: string,
  windowFallbackMs: number,
): RateLimitTierConfig {
  return {
    requestsPerWindow: getNumber(requestsKey, requestsFallback),
    windowMs: getDurationMs(windowKey, windowFallbackMs),
  };
}

export type AppConfig = AppConfigShape;

export default registerAs('app', (): AppConfig => ({
  app: {
    env: getString('NODE_ENV', 'development'),
    port: getNumber('PORT', 3000),
    apiBaseUrl: getString('API_BASE_URL', 'http://localhost:3000/api'),
    frontendUrl: getString('FRONTEND_URL', 'http://localhost:3000'),
  },
  database: {
    url: getString('DATABASE_URL'),
    directUrl: getString('DIRECT_URL'),
  },
  supabase: {
    url: getString('SUPABASE_URL'),
    anonKey: getString('SUPABASE_ANON_KEY'),
    serviceRoleKey: getString('SUPABASE_SERVICE_ROLE_KEY'),
    projectRef: getString('SUPABASE_PROJECT_REF'),
  },
  smtp: {
    host: getString('SMTP_HOST'),
    port: getNumber('SMTP_PORT', 587),
    user: getString('SMTP_USER'),
    password: getString('SMTP_PASSWORD'),
    from: getString('SMTP_FROM', getString('SMTP_USER')),
  },
  redis: {
    enabled: getBoolean('REDIS_ENABLED', true),
    host: getString('REDIS_HOST', '127.0.0.1'),
    port: getNumber('REDIS_PORT', 6379),
    password: getString('REDIS_PASSWORD') || undefined,
    db: getNumber('REDIS_DB', 0),
    ttlSeconds: getNumber('REDIS_TTL_SECONDS', 300),
    keyPrefix: getString('REDIS_KEY_PREFIX', 'easy-point'),
  },
  rateLimit: {
    enabled: getBoolean('RATE_LIMIT_ENABLED', true),
    global: buildRateLimitTier(
      'RATE_LIMIT_GLOBAL_REQUESTS',
      10000,
      'RATE_LIMIT_GLOBAL_WINDOW',
      60 * MILLISECONDS_IN_SECOND,
    ),
    strictIp: buildRateLimitTier(
      'RATE_LIMIT_STRICT_IP_REQUESTS',
      5,
      'RATE_LIMIT_STRICT_IP_WINDOW',
      60 * 60 * MILLISECONDS_IN_SECOND,
    ),
    moderateIp: buildRateLimitTier(
      'RATE_LIMIT_MODERATE_IP_REQUESTS',
      100,
      'RATE_LIMIT_MODERATE_IP_WINDOW',
      60 * MILLISECONDS_IN_SECOND,
    ),
    readOps: buildRateLimitTier(
      'RATE_LIMIT_READ_REQUESTS',
      300,
      'RATE_LIMIT_READ_WINDOW',
      60 * MILLISECONDS_IN_SECOND,
    ),
    writeOps: buildRateLimitTier(
      'RATE_LIMIT_WRITE_REQUESTS',
      30,
      'RATE_LIMIT_WRITE_WINDOW',
      60 * MILLISECONDS_IN_SECOND,
    ),
  },
  jwt: {
    secret: getString('JWT_SECRET', 'fallback_secreto_desarrollo_temporal'),
    expiresIn: getString('JWT_EXPIRES_IN', '15m'),
    refreshSecret: getString('JWT_REFRESH_SECRET', 'fallback_refresh_secreto_7X'),
    refreshExpiresIn: getString('JWT_REFRESH_EXPIRES_IN', '7d'),
  },
}));
