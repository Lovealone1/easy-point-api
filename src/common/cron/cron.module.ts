import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CronService } from './cron.service';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(), // Used to decouple jobs from other modules
  ],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
