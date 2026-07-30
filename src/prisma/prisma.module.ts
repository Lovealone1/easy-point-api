import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { DatabaseRegistryService } from './database-registry.service.js';

@Global()
@Module({
  providers: [PrismaService, DatabaseRegistryService],
  exports: [PrismaService, DatabaseRegistryService],
})
export class PrismaModule {}
