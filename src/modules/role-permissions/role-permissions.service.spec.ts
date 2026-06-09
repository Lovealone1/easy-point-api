import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { RolePermissionsService } from './role-permissions.service.js';
import { RolePermissionsRepository } from './role-permissions.repository.js';

describe('RolePermissionsService', () => {
  let service: RolePermissionsService;
  let repository: jest.Mocked<RolePermissionsRepository>;

  const mockRole = {
    id: 'role-1',
    organizationId: 'org-1',
    name: 'CUSTOM_ROLE',
    isSystemDefault: false,
  };

  const mockSystemRole = {
    id: 'role-system',
    organizationId: 'org-1',
    name: 'OWNER',
    isSystemDefault: true,
  };

  const mockPermission = {
    id: 'perm-1',
    key: 'sales:create',
    isActive: true,
  };

  beforeEach(async () => {
    const mockRepository = {
      findRoleByIdAndOrg: jest.fn(),
      getPermissionKeysByRole: jest.fn(),
      findPermissionByIdAndOrg: jest.fn(),
      findRolePermission: jest.fn(),
      assignPermission: jest.fn(),
      revokePermission: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolePermissionsService,
        {
          provide: RolePermissionsRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<RolePermissionsService>(RolePermissionsService);
    repository = module.get(RolePermissionsRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRolePermissions', () => {
    it('should successfully return permission keys for a valid role', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.getPermissionKeysByRole.mockResolvedValue(['sales:create', 'sales:read']);

      const result = await service.getRolePermissions('role-1', 'org-1');

      expect(repository.findRoleByIdAndOrg).toHaveBeenCalledWith('role-1', 'org-1');
      expect(repository.getPermissionKeysByRole).toHaveBeenCalledWith('role-1', 'org-1');
      expect(result).toEqual(['sales:create', 'sales:read']);
    });

    it('should throw NotFoundException if role does not exist or org mismatch', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(null);

      await expect(service.getRolePermissions('role-unknown', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignPermission', () => {
    it('should successfully assign permission if valid, not assigned, and custom role', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findPermissionByIdAndOrg.mockResolvedValue(mockPermission as any);
      repository.findRolePermission.mockResolvedValue(null);
      repository.assignPermission.mockResolvedValue({ id: 'rp-1' } as any);

      const result = await service.assignPermission('role-1', 'perm-1', 'org-1');

      expect(repository.findRoleByIdAndOrg).toHaveBeenCalledWith('role-1', 'org-1');
      expect(repository.findPermissionByIdAndOrg).toHaveBeenCalledWith('perm-1', 'org-1');
      expect(repository.findRolePermission).toHaveBeenCalledWith('role-1', 'perm-1');
      expect(repository.assignPermission).toHaveBeenCalledWith('role-1', 'perm-1', 'org-1');
      expect(result).toEqual({ id: 'rp-1' });
    });

    it('should throw ConflictException if already assigned', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findPermissionByIdAndOrg.mockResolvedValue(mockPermission as any);
      repository.findRolePermission.mockResolvedValue({ id: 'rp-existing' } as any);

      await expect(
        service.assignPermission('role-1', 'perm-1', 'org-1'),
      ).rejects.toThrow(ConflictException);

      expect(repository.findRolePermission).toHaveBeenCalledWith('role-1', 'perm-1');
      expect(repository.assignPermission).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if role is system default', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockSystemRole as any);

      await expect(
        service.assignPermission('role-system', 'perm-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);

      expect(repository.assignPermission).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if permission is invalid/inactive/disabled', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findPermissionByIdAndOrg.mockResolvedValue(null);

      await expect(
        service.assignPermission('role-1', 'perm-invalid', 'org-1'),
      ).rejects.toThrow(
        new BadRequestException(
          'El permiso no existe, está inactivo o pertenece a un módulo no habilitado para la organización',
        ),
      );

      expect(repository.assignPermission).not.toHaveBeenCalled();
    });
  });

  describe('revokePermission', () => {
    it('should successfully delete relation if custom role and relation exists', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findRolePermission.mockResolvedValue({ id: 'rp-1' } as any);
      repository.revokePermission.mockResolvedValue(undefined as any);

      await service.revokePermission('role-1', 'perm-1', 'org-1');

      expect(repository.findRoleByIdAndOrg).toHaveBeenCalledWith('role-1', 'org-1');
      expect(repository.findRolePermission).toHaveBeenCalledWith('role-1', 'perm-1');
      expect(repository.revokePermission).toHaveBeenCalledWith('role-1', 'perm-1');
    });

    it('should throw BadRequestException if trying to revoke from system default role', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockSystemRole as any);

      await expect(
        service.revokePermission('role-system', 'perm-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);

      expect(repository.revokePermission).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if relation does not exist', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findRolePermission.mockResolvedValue(null);

      await expect(
        service.revokePermission('role-1', 'perm-1', 'org-1'),
      ).rejects.toThrow(NotFoundException);

      expect(repository.revokePermission).not.toHaveBeenCalled();
    });
  });
});
