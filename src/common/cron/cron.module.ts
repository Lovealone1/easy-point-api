import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CronService } from './cron.service.js';
import { SubscriptionsModule } from '../../modules/subscriptions/subscriptions.module.js';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(), // Used to decouple jobs from other modules
    SubscriptionsModule,
  ],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
