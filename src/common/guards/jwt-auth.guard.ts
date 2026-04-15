import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import appConfig from '../config/config.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    try {
      // The secret is retrieved dynamically from environment variables just as configured in the module.
      // Alternatively, we could inject ConfigType<typeof appConfig> here.
      // For simplicity, we use the raw access through process.env or fallback.
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'fallback_secreto_desarrollo_temporal',
      });
      
      // STATEFUL CHECK: Verify if the session ID (sid) is still active in Redis
      const sessionKey = `session_metadata:${payload.sub}:${payload.sid}`;
      const isActive = await this.redisCacheService.get(sessionKey);

      if (!isActive) {
        throw new UnauthorizedException('Session has been revoked or expired');
      }

      // Attach the user payload to the request object so our route handlers can access it
      request['user'] = payload;
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired token');
    }
    
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
