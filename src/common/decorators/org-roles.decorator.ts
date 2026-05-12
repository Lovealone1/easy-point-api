import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum.js';

export const ORG_ROLES_KEY = 'org-roles';
export const OrgRoles = (...roles: Role[]) => SetMetadata(ORG_ROLES_KEY, roles);
