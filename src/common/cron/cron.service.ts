import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CronJob } from 'cron';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../config/config.js';
import { SubscriptionLifecycleService } from '../../modules/subscriptions/subscription-lifecycle.service.js';

@Injectable()
export class CronService implements OnModuleInit {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly subscriptionLifecycleService: SubscriptionLifecycleService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) { }

  onModuleInit() {
    const cronExpression = this.config.cron.subscriptionCheck;
    this.logger.log(`Registering subscription lifecycle cron job with expression: ${cronExpression}`);

    try {
      const job = new CronJob(cronExpression, async () => {
        this.logger.log('Starting scheduled subscription lifecycle check...');
        try {
          await this.subscriptionLifecycleService.processSubscriptionLifecycle();
        } catch (err: any) {
          this.logger.error('Scheduled subscription lifecycle check failed', err.stack);
        }
      });

      this.schedulerRegistry.addCronJob('subscriptionLifecycleCheck', job);
      job.start();
    } catch (error: any) {
      this.logger.error(`Failed to register subscription lifecycle cron job with expression: ${cronExpression}`, error.stack);
    }
  }

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
