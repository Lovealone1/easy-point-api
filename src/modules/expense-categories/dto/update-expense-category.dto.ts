import { PartialType } from '@nestjs/swagger';
import { CreateExpenseCategoryDto } from './create-expense-category.dto.js';

export class UpdateExpenseCategoryDto extends PartialType(CreateExpenseCategoryDto) {}
