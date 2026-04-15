import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<GlobalRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    // In our hybrid stateless/stateful system, JwtAuthGuard populates the request.user 
    // directly from the JWT payload which now includes the 'role' property.
    if (!user || !user.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('You do not have the required global permissions to access this resource');
    }
    
    return true;
  }
}
