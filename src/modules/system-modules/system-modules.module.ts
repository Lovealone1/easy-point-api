import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { SystemModulesController } from './system-modules.controller.js';
import { SystemModulesService } from './system-modules.service.js';
import { SystemModulesRepository } from './system-modules.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [SystemModulesController],
  providers: [SystemModulesService, SystemModulesRepository],
  exports: [SystemModulesService],
})
export class SystemModulesModule {}
