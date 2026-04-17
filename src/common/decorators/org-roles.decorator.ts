import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ORG_ROLES_KEY = 'org-roles';
export const OrgRoles = (...roles: Role[]) => SetMetadata(ORG_ROLES_KEY, roles);
