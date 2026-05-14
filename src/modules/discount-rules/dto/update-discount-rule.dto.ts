import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateDiscountRuleDto } from './create-discount-rule.dto.js';

/**
 * Para el update se omite `type` y `scope` porque cambiarlos después de creado
 * podría invalidar la lógica de aplicaciones previas. Exponer `category`
 * para correcciones de PERIODIC ↔ ONE_TIME está permitido.
 */
export class UpdateDiscountRuleDto extends PartialType(
  OmitType(CreateDiscountRuleDto, ['type', 'scope'] as const),
) {}
