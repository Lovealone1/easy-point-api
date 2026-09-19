import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole, SessionScope } from '@prisma/client';
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

    // Holding the ADMIN role is not enough — the request has to arrive on a
    // console session. This single check is what puts every global-admin
    // endpoint in the codebase behind the separate console sign-in, without
    // touching the controllers: they already declare @Roles(GlobalRole.ADMIN),
    // and every one of them is an admin-console route (the `global/all`
    // family and the admin-only controllers), never something the dashboard
    // calls.
    if (requiredRoles.includes(GlobalRole.ADMIN) && user.scope !== SessionScope.ADMIN) {
      throw new ForbiddenException(
        'This resource requires an administration console session. Sign in to the console to continue.',
      );
    }

    return true;
  }
}
