import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import appConfig from '../../common/config/config.js';
import { AuthController } from './auth.controller.js';
import { DevelopmentController } from './development.controller.js';
import { AuthService } from './auth.service.js';
import { RedisModule } from '../../infraestructure/redis/redis.module.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';
import { InvitationsModule } from '../invitations/invitations.module.js';

@Module({
  imports: [
    RedisModule,
    JwtModule.registerAsync({
      global: true,
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => ({
        secret: config.jwt.secret,
        signOptions: {
          expiresIn: config.jwt.expiresIn as any,
        },
      }),
    }),
    forwardRef(() => InvitationsModule),
  ],
  // DevelopmentController exposes debug-only endpoints (plaintext OTP echo,
  // pending invitation tokens). It must not exist as a route at all outside
  // development — a runtime env check inside the controller is not enough,
  // since the route would still be reachable and listed in Swagger.
  controllers: [
    AuthController,
    ...(process.env.NODE_ENV === 'development' ? [DevelopmentController] : []),
  ],
  providers: [AuthService, MailService],
})
export class AuthModule {}
