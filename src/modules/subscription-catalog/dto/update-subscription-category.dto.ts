import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionCategoryDto } from './create-subscription-category.dto.js';

export class UpdateSubscriptionCategoryDto extends PartialType(CreateSubscriptionCategoryDto) {}
