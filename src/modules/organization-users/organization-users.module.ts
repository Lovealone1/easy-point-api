import { Module } from '@nestjs/common';
import { OrganizationUsersService } from './organization-users.service.js';
import { OrganizationUsersController } from './organization-users.controller.js';
import { OrganizationUsersRepository } from './organization-users.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationUsersController],
  providers: [OrganizationUsersService, OrganizationUsersRepository],
  exports: [OrganizationUsersService, OrganizationUsersRepository],
})
export class OrganizationUsersModule {}
