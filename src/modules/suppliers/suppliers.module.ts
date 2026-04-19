import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersRepository } from './suppliers.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [SuppliersController],
  providers: [SuppliersService, SuppliersRepository],
  exports: [SuppliersService],
})
export class SuppliersModule {}
