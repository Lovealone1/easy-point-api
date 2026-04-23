import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly eventEmitter: EventEmitter2) { }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'generalCleanupTask',
    timeZone: 'America/Bogota', // Adjust to project timezone if necessary
  })
  async handleGeneralCleanup() {
    this.logger.log('Starting general cleanup task...');
    try {

      this.eventEmitter.emit('cron.daily_midnight');

      this.logger.log('General cleanup task finished successfully.');
    } catch (error: any) {
      this.logger.error('Error during general cleanup task', error.stack);
    }
  }
}
