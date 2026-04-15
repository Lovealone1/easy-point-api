import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import appConfig from '../../common/config/config.js';
import { AuthController } from './auth.controller.js';
import { DevelopmentController } from './development.controller.js';
import { AuthService } from './auth.service.js';
import { RedisModule } from '../../infraestructure/redis/redis.module.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';

@Module({
  imports: [
    RedisModule,
    JwtModule.registerAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => ({
        secret: config.jwt.secret,
        signOptions: {
          expiresIn: config.jwt.expiresIn as any,
        },
      }),
    }),
  ],
  controllers: [AuthController, DevelopmentController],
  providers: [AuthService, MailService],
})
export class AuthModule {}
