import { Module } from '@nestjs/common';
import { OrganizationConfigsService } from './organization-configs.service.js';
import { OrganizationConfigsController } from './organization-configs.controller.js';
import { OrganizationConfigsRepository } from './organization-configs.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationConfigsController],
  providers: [OrganizationConfigsService, OrganizationConfigsRepository],
  exports: [OrganizationConfigsService],
})
export class OrganizationConfigsModule {}
