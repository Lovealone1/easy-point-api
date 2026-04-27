import { PartialType } from '@nestjs/swagger';
import { CreateTransactionCategoryDto } from './create-transaction-category.dto.js';

export class UpdateTransactionCategoryDto extends PartialType(CreateTransactionCategoryDto) {}
