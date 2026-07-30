import { Controller, Get, HttpCode, HttpStatus, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service.js';
import { REDIS_CLIENT } from '../../infraestructure/redis/redis.constants.js';
import appConfig from '../../common/config/config.js';

@Controller('health')
@ApiExcludeController()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @Inject(appConfig.KEY) private readonly config: ConfigType<typeof appConfig>,
  ) {}

  // Liveness: process is up and can respond. No external dependencies —
  // used by Docker HEALTHCHECK and the reverse proxy.
  @Get()
  @HttpCode(HttpStatus.OK)
  liveness() {
    return { status: 'ok' };
  }

  // Readiness: can the app actually serve traffic (DB + cache reachable)?
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async readiness() {
    const checks: Record<string, 'ok' | 'error'> = {};
    let healthy = true;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
      healthy = false;
    }

    if (this.config.redis.enabled) {
      try {
        await this.redisClient.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'error';
        healthy = false;
      }
    }

    if (!healthy) {
      const failed = Object.entries(checks)
        .filter(([, value]) => value === 'error')
        .map(([key]) => key)
        .join(', ');
      throw new ServiceUnavailableException({
        status: 'error',
        message: `Not ready — unhealthy dependencies: ${failed}`,
        checks,
      });
    }

    return { status: 'ok', checks };
  }
}
