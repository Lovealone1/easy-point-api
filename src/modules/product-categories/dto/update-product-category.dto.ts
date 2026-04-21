import { PartialType } from '@nestjs/swagger';
import { CreateProductCategoryDto } from './create-product-category.dto.js';

export class UpdateProductCategoryDto extends PartialType(CreateProductCategoryDto) {}
