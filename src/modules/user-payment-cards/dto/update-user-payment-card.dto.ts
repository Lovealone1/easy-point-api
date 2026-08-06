import { PartialType } from '@nestjs/swagger';
import { CreateUserPaymentCardDto } from './create-user-payment-card.dto.js';

export class UpdateUserPaymentCardDto extends PartialType(CreateUserPaymentCardDto) {}
