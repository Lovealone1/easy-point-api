import { Module } from '@nestjs/common';
import { UserInfoService } from './user-info.service.js';
import { UserInfoController } from './user-info.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [UserInfoController],
  providers: [UserInfoService],
  exports: [UserInfoService],
})
export class UserInfoModule {}
