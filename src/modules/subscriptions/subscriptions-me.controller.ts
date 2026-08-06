import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiSecurity } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';
import { getTenantId } from '../../common/context/tenant.context.js';

/**
 * Org-scoped subscription status — split from SubscriptionsController
 * (admin-only) because any org member, including one whose trial just
 * expired, must be able to read this to render the trial-expired page.
 */
@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AllowWithoutSubscription()
@Controller('subscriptions/me')
export class SubscriptionsMeController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: "Get the caller's organization subscription/access state" })
  @ApiOkResponse({ description: 'Subscription state resolved.' })
  getMyState() {
    return this.subscriptionsService.getMyOrganizationState(getTenantId() ?? '');
  }
}
