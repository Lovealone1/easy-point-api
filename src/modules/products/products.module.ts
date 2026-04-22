import { Module } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsRepository } from './products.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService],
})
export class ProductsModule {}
