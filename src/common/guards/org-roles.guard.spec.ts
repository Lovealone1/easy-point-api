import { ExecutionContext, ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRolesGuard } from './org-roles.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Role } from '../enums/role.enum.js';
import { GlobalRole, OrganizationStatus } from '@prisma/client';

// Mock getTenantId
jest.mock('../context/tenant.context.js', () => ({
  getTenantId: jest.fn(),
}));

import { getTenantId } from '../context/tenant.context.js';

describe('OrgRolesGuard', () => {
  let guard: OrgRolesGuard;
  let reflector: jest.Mocked<Reflector>;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    prismaService = {
      organization: {
        findUnique: jest.fn(),
      },
      organizationUser: {
        findUnique: jest.fn(),
      },
    } as any;

    guard = new OrgRolesGuard(reflector, prismaService);
    (getTenantId as jest.Mock).mockReset();
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  };

  it('should allow access if no roles are required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({ sub: 'user-1' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if user is not authenticated', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER]);
    const context = createMockContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow access for Global Admin regardless of organization', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER]);
    const context = createMockContext({ sub: 'user-1', role: GlobalRole.ADMIN });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if organizationId cannot be inferred', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER]);
    const context = createMockContext({ sub: 'user-1' });
    (getTenantId as jest.Mock).mockReturnValue(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should deny access if organization is inactive', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER]);
    const context = createMockContext({ sub: 'user-1' });
    (getTenantId as jest.Mock).mockReturnValue('org-1');
    
    (prismaService.organization.findUnique as jest.Mock).mockResolvedValue({
      id: 'org-1',
      status: OrganizationStatus.SUSPENDED,
      isActive: false,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should deny access if user is not part of the organization', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER]);
    const context = createMockContext({ sub: 'user-1' });
    (getTenantId as jest.Mock).mockReturnValue('org-1');
    
    (prismaService.organization.findUnique as jest.Mock).mockResolvedValue({
      id: 'org-1',
      status: OrganizationStatus.ACTIVE,
      isActive: true,
    });

    (prismaService.organizationUser.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should deny access if user role does not match required roles (new Role relation check)', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER]);
    const context = createMockContext({ sub: 'user-1' });
    (getTenantId as jest.Mock).mockReturnValue('org-1');
    
    (prismaService.organization.findUnique as jest.Mock).mockResolvedValue({
      id: 'org-1',
      status: OrganizationStatus.ACTIVE,
      isActive: true,
    });

    // Mocking the new related Role table structure
    (prismaService.organizationUser.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
      role: {
        name: Role.USER, // Has USER, but needs OWNER
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow access if user role matches required roles', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER]);
    const context = createMockContext({ sub: 'user-1' });
    (getTenantId as jest.Mock).mockReturnValue('org-1');
    
    (prismaService.organization.findUnique as jest.Mock).mockResolvedValue({
      id: 'org-1',
      status: OrganizationStatus.ACTIVE,
      isActive: true,
    });

    // Mocking the new related Role table structure
    (prismaService.organizationUser.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
      role: {
        name: Role.OWNER, // Matches required role
      },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
