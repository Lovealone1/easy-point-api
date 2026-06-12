import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { OrganizationModulesController } from './organization-modules.controller.js';
import { OrganizationModulesService } from './organization-modules.service.js';
import { OrganizationModulesRepository } from './organization-modules.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationModulesController],
  providers: [OrganizationModulesService, OrganizationModulesRepository],
  exports: [OrganizationModulesService],
})
export class OrganizationModulesModule {}
