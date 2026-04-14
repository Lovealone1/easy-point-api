import { LoggerService } from '@nestjs/common';
import chalk from 'chalk';

export class AppLogger implements LoggerService {
  private format(level: string, message: any) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  log(message: any) {
    console.log(chalk.blue(this.format('LOG', message)));
  }

  warn(message: any) {
    console.log(chalk.yellow(this.format('WARNING', message)));
  }

  error(message: any, trace?: string) {
    console.log(chalk.red.bold(this.format('ERROR', message)));
    if (trace) {
      console.log(chalk.gray(trace));
    }
  }

  debug(message: any) {
    console.log(chalk.magenta(this.format('DEBUG', message)));
  }

  verbose(message: any) {
    console.log(chalk.cyan(this.format('VERBOSE', message)));
  }

  success(message: any) {
    console.log(chalk.green(this.format('SUCCESS', message)));
  }

  danger(message: any) {
    console.log(chalk.red(this.format('DANGER', message)));
  }
}
