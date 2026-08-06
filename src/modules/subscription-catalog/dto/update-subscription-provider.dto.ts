import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionProviderDto } from './create-subscription-provider.dto.js';

export class UpdateSubscriptionProviderDto extends PartialType(CreateSubscriptionProviderDto) {}
