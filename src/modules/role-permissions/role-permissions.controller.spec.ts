import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { BadRequestException } from '@nestjs/common';
import { RolePermissionsController } from './role-permissions.controller.js';
import { RolePermissionsService } from './role-permissions.service.js';
import { AssignRolePermissionDto } from './dto/assign-role-permission.dto.js';

// Mock getTenantId
jest.mock('../../common/context/tenant.context.js', () => ({
  getTenantId: jest.fn(),
}));

import { getTenantId } from '../../common/context/tenant.context.js';

describe('RolePermissionsController', () => {
  let controller: RolePermissionsController;
  let service: jest.Mocked<RolePermissionsService>;

  beforeEach(async () => {
    const mockService = {
      getRolePermissions: jest.fn(),
      assignPermission: jest.fn(),
      revokePermission: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolePermissionsController],
      providers: [
        {
          provide: RolePermissionsService,
          useValue: mockService,
        },
      ],
    })
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
    .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
    .compile();

    controller = module.get<RolePermissionsController>(RolePermissionsController);
    service = module.get(RolePermissionsService);

    // Default tenant for most tests
    (getTenantId as jest.Mock).mockReturnValue('org-1');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestException if organization context is missing', async () => {
    (getTenantId as jest.Mock).mockReturnValue(undefined);

    await expect(controller.getRolePermissions('role-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('getRolePermissions', () => {
    it('should delegate to service', async () => {
      service.getRolePermissions.mockResolvedValue(['sales:create']);

      const result = await controller.getRolePermissions('role-1');

      expect(service.getRolePermissions).toHaveBeenCalledWith('role-1', 'org-1');
      expect(result).toEqual(['sales:create']);
    });
  });

  describe('assignPermission', () => {
    it('should delegate to service', async () => {
      const dto: AssignRolePermissionDto = { roleId: 'role-1', permissionId: 'perm-1' };
      service.assignPermission.mockResolvedValue({ id: 'rp-1', roleId: 'role-1', permissionId: 'perm-1' } as any);

      const result = await controller.assignPermission(dto);

      expect(service.assignPermission).toHaveBeenCalledWith(
        'role-1',
        'perm-1',
        'org-1',
      );
      expect(result).toEqual({ id: 'rp-1', roleId: 'role-1', permissionId: 'perm-1' });
    });
  });

  describe('revokePermission', () => {
    it('should delegate to service and return confirmation message', async () => {
      service.revokePermission.mockResolvedValue(undefined);

      const result = await controller.revokePermission('role-1', 'perm-1');

      expect(service.revokePermission).toHaveBeenCalledWith('role-1', 'perm-1', 'org-1');
      expect(result).toEqual({ message: 'Permiso revocado exitosamente' });
    });
  });
});
