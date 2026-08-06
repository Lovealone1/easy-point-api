import { PartialType } from '@nestjs/swagger';
import { CreateUserSubscriptionDto } from './create-user-subscription.dto.js';

export class UpdateUserSubscriptionDto extends PartialType(CreateUserSubscriptionDto) {}
