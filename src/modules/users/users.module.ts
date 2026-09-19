import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UsersRepository } from './users.repository.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';
import { SessionsModule } from '../sessions/sessions.module.js';

@Module({
  // SessionsModule owns tearing a session down; changing an account's email
  // has to sign it out everywhere, and doing that by hand here is how the
  // pre-split Redis keys survived the namespace change unnoticed.
  imports: [PrismaModule, SessionsModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, MailService],
  exports: [UsersService],
})
export class UsersModule {}
