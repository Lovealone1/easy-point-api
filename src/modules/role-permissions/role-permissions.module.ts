import { Module } from '@nestjs/common';
import { RolePermissionsController } from './role-permissions.controller.js';
import { RolePermissionsService } from './role-permissions.service.js';
import { RolePermissionsRepository } from './role-permissions.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [RolePermissionsController],
  providers: [RolePermissionsService, RolePermissionsRepository],
  exports: [RolePermissionsService, RolePermissionsRepository],
})
export class RolePermissionsModule {}
