import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { getTenantId } from '../context/tenant.context.js';
import { ALLOW_WITHOUT_SUBSCRIPTION_KEY } from '../decorators/allow-without-subscription.decorator.js';
import { SubscriptionExpiredError } from '../exceptions/domain.exceptions.js';

const CACHE_TTL_SECONDS = 30;

type AccessState = { blocked: false } | { blocked: true; isTrial: boolean };

/**
 * Global guard: blocks every organization-scoped request once the org's
 * subscription (trial or paid) has lapsed. Runs as an APP_GUARD, so it must
 * be defensive about routes that aren't authenticated or aren't org-scoped —
 * JwtAuthGuard and PermissionsGuard remain the source of truth for those.
 *
 * A subscription grants access while its status is ACTIVE or TRIALING and
 * currentPeriodEnd hasn't passed — this mirrors the read model used by
 * OrganizationsRepository (see currentSubscriptionWhere).
 */
@Injectable()
export class SubscriptionAccessGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isExempt = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WITHOUT_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isExempt) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No decoded user yet (AuthContextMiddleware is best-effort) — let
    // JwtAuthGuard reject unauthenticated requests downstream.
    if (!user) return true;

    // Global platform admins are never blocked by a tenant's subscription.
    if (user.role === GlobalRole.ADMIN) return true;

    const organizationId = getTenantId();
    // Not an org-scoped request (e.g. /auth/me before an org is chosen).
    if (!organizationId) return true;

    const state = await this.resolveAccessState(organizationId);
    if (!state.blocked) return true;

    throw new SubscriptionExpiredError(organizationId, state.isTrial);
  }

  private async resolveAccessState(organizationId: string): Promise<AccessState> {
    const cacheKey = `subscription_access:${organizationId}`;
    const cached = await this.redisCacheService.get<AccessState>(cacheKey);
    if (cached) return cached;

    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    let state: AccessState;

    if (!subscription) {
      // No subscription row at all — fail open rather than locking out an
      // organization created before this feature existed.
      this.logger.warn(`Organization ${organizationId} has no subscription record; allowing access.`);
      state = { blocked: false };
    } else {
      const hasAccess =
        (subscription.status === SubscriptionStatus.ACTIVE ||
          subscription.status === SubscriptionStatus.TRIALING) &&
        subscription.currentPeriodEnd >= new Date();

      state = hasAccess
        ? { blocked: false }
        : { blocked: true, isTrial: subscription.plan.name.toUpperCase() === 'FREE' };
    }

    await this.redisCacheService.set(cacheKey, state, CACHE_TTL_SECONDS);
    return state;
  }
}
