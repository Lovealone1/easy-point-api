import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuditService } from './audit.service.js';
import { AuditConsumer } from './audit.consumer.js';
import { AuditRepository } from './audit.repository.js';
import { AuditController } from './audit.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

/**
 * AuditModule — Global infrastructure module for cross-cutting audit concerns.
 *
 * Deliberately placed in `src/infraestructure/` (alongside Redis, Mail) rather
 * than `src/modules/` because audit is an infrastructure/observability concern,
 * not a business feature.
 *
 * Marked @Global so AuditService is injectable anywhere without explicit imports.
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    PrismaModule,
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditConsumer, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
