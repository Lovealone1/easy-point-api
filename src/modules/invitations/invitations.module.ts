import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsRepository } from './invitations.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { OrganizationUsersModule } from '../organization-users/organization-users.module.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';

@Module({
  imports: [PrismaModule, OrganizationUsersModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationsRepository, MailService],
  exports: [InvitationsService],
})
export class InvitationsModule {}


