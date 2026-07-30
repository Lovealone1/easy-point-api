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
    trustProxy: boolean | number | string;
  };
  cors: {
    origins: string[];
  };
  swagger: {
    enabled: boolean;
  };
  database: {
    url: string;
    directUrl: string;
    /** Dedicated per-tenant databases, keyed by Organization.databaseId. */
    tenantUrls: Record<string, string>;
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
    refreshExpiresInMs: number;
  };
  s3: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  };
  cron: {
    subscriptionCheck: string;
  };
  subscriptions: {
    gracePeriodDays: number;
  };
  audit: {
    retentionDays: number;
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

function getStringList(key: string, fallback: string[] = []): string[] {
  const rawValue = process.env[key];

  if (!rawValue) {
    return fallback;
  }

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Parses a comma-separated list of `key=value` pairs, e.g.
 *   TENANT_DATABASE_URLS="acme=postgresql://...,globex=postgresql://..."
 * Values may contain '=' (connection strings often do), so only the first
 * '=' is treated as the separator.
 */
function getKeyValueMap(key: string): Record<string, string> {
  const rawValue = process.env[key];

  if (!rawValue) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const entry of rawValue.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const entryKey = trimmed.slice(0, separatorIndex).trim();
    const entryValue = trimmed.slice(separatorIndex + 1).trim();

    if (entryKey && entryValue) {
      result[entryKey] = entryValue;
    }
  }

  return result;
}

function getTrustProxy(fallback: boolean | number | string): boolean | number | string {
  const rawValue = process.env['TRUST_PROXY'];

  if (!rawValue) {
    return fallback;
  }

  const normalizedValue = rawValue.trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  const parsedNumber = Number(normalizedValue);
  if (Number.isFinite(parsedNumber)) {
    return parsedNumber;
  }

  // Comma-separated list of trusted proxy IPs/CIDRs (e.g. "loopback,linklocal,uniquelocal")
  return rawValue;
}

/**
 * Fails startup fast with a single readable error instead of letting the app
 * boot with an insecure fallback (e.g. a hardcoded JWT secret) or crash later
 * mid-request with a confusing stack trace.
 */
function validateConfig(): void {
  const missing: string[] = [];
  const env = getString('NODE_ENV', 'development');

  const jwtSecret = getString('JWT_SECRET');
  const jwtRefreshSecret = getString('JWT_REFRESH_SECRET');

  if (!jwtSecret || jwtSecret.length < 32) {
    missing.push('JWT_SECRET (must be set and at least 32 characters long)');
  }

  if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
    missing.push('JWT_REFRESH_SECRET (must be set and at least 32 characters long)');
  }

  if (jwtSecret && jwtRefreshSecret && jwtSecret === jwtRefreshSecret) {
    missing.push('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
  }

  if (!getString('DATABASE_URL')) {
    missing.push('DATABASE_URL');
  }

  if (!getString('DIRECT_URL')) {
    missing.push('DIRECT_URL');
  }

  if (env === 'production') {
    if (getStringList('CORS_ORIGINS').length === 0) {
      missing.push('CORS_ORIGINS (comma-separated list, required in production)');
    }

    if (!getString('SMTP_HOST')) missing.push('SMTP_HOST');
    if (!getString('SMTP_USER')) missing.push('SMTP_USER');
    if (!getString('SMTP_PASSWORD')) missing.push('SMTP_PASSWORD');

    if (!getString('S3_ENDPOINT')) missing.push('S3_ENDPOINT');
    if (!getString('S3_ACCESS_KEY_ID')) missing.push('S3_ACCESS_KEY_ID');
    if (!getString('S3_SECRET_ACCESS_KEY')) missing.push('S3_SECRET_ACCESS_KEY');
    if (!getString('S3_BUCKET_NAME')) missing.push('S3_BUCKET_NAME');

    if (getBoolean('REDIS_ENABLED', true) && !getString('REDIS_PASSWORD')) {
      missing.push('REDIS_PASSWORD (required in production when REDIS_ENABLED=true)');
    }

    const apiBaseUrl = getString('API_BASE_URL');
    if (apiBaseUrl && !apiBaseUrl.startsWith('https://')) {
      missing.push('API_BASE_URL must use https:// in production');
    }

    const frontendUrl = getString('FRONTEND_URL');
    if (frontendUrl && !frontendUrl.startsWith('https://')) {
      missing.push('FRONTEND_URL must use https:// in production');
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `\n\n[Config] Cannot start application — missing or invalid environment variables:\n` +
        missing.map((item) => `  - ${item}`).join('\n') +
        '\n',
    );
  }
}

export type AppConfig = AppConfigShape;

export default registerAs('app', (): AppConfig => {
  validateConfig();

  return {
    app: {
      env: getString('NODE_ENV', 'development'),
      port: getNumber('PORT', 3000),
      apiBaseUrl: getString('API_BASE_URL', 'http://localhost:3000/api'),
      frontendUrl: getString('FRONTEND_URL', 'http://localhost:3000'),
      trustProxy: getTrustProxy(false),
    },
    cors: {
      origins: getStringList('CORS_ORIGINS'),
    },
    swagger: {
      enabled: getBoolean('SWAGGER_ENABLED', getString('NODE_ENV', 'development') !== 'production'),
    },
    database: {
      url: getString('DATABASE_URL'),
      directUrl: getString('DIRECT_URL'),
      tenantUrls: getKeyValueMap('TENANT_DATABASE_URLS'),
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
      secret: getString('JWT_SECRET'),
      expiresIn: getString('JWT_EXPIRES_IN', '15m'),
      refreshSecret: getString('JWT_REFRESH_SECRET'),
      refreshExpiresIn: getString('JWT_REFRESH_EXPIRES_IN', '30d'),
      refreshExpiresInMs: getDurationMs('JWT_REFRESH_EXPIRES_IN', 30 * 24 * 60 * 60 * 1000),
    },
    s3: {
      endpoint: getString('S3_ENDPOINT'),
      region: getString('S3_REGION', 'us-east-1'),
      accessKeyId: getString('S3_ACCESS_KEY_ID'),
      secretAccessKey: getString('S3_SECRET_ACCESS_KEY'),
      bucketName: getString('S3_BUCKET_NAME'),
    },
    cron: {
      subscriptionCheck: getString('CRON_SUBSCRIPTION_CHECK', '0 0 * * *'),
    },
    subscriptions: {
      gracePeriodDays: getNumber('SUBSCRIPTION_GRACE_PERIOD_DAYS', 3),
    },
    audit: {
      retentionDays: getNumber('AUDIT_LOG_RETENTION_DAYS', 30),
    },
  };
});
