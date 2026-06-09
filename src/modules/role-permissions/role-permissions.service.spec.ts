import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { RolePermissionsService } from './role-permissions.service.js';
import { RolePermissionsRepository } from './role-permissions.repository.js';
import { AuditService } from '../../infraestructure/audit/audit.service.js';
import { AuditAction } from '../../infraestructure/audit/enums/audit-action.enum.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { ROLE_DIRTY_PREFIX } from '../../infraestructure/redis/role-dirty.constants.js';

describe('RolePermissionsService', () => {
  let service: RolePermissionsService;
  let repository: jest.Mocked<RolePermissionsRepository>;
  let auditService: jest.Mocked<AuditService>;
  let redisCacheService: jest.Mocked<RedisCacheService>;

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

  const mockAdminRole = {
    id: 'role-admin',
    organizationId: 'org-1',
    name: 'ADMINISTRATOR',
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

    const mockAuditService = {
      log: jest.fn(),
      logSync: jest.fn(),
      patchUserContext: jest.fn(),
    };

    const mockRedisCacheService = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      mget: jest.fn(),
      incr: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolePermissionsService,
        { provide: RolePermissionsRepository, useValue: mockRepository },
        { provide: AuditService,              useValue: mockAuditService },
        { provide: RedisCacheService,         useValue: mockRedisCacheService },
      ],
    }).compile();

    service            = module.get<RolePermissionsService>(RolePermissionsService);
    repository         = module.get(RolePermissionsRepository);
    auditService       = module.get(AuditService);
    redisCacheService  = module.get(RedisCacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getRolePermissions
  // ─────────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────────
  // assignPermission
  // ─────────────────────────────────────────────────────────────────────────────
  describe('assignPermission', () => {
    it('should successfully assign permission if valid, not assigned, and custom role', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findPermissionByIdAndOrg.mockResolvedValue(mockPermission as any);
      repository.findRolePermission.mockResolvedValue(null);
      repository.assignPermission.mockResolvedValue({ id: 'rp-1' } as any);

      const result = await service.assignPermission('role-1', 'perm-1', 'org-1');

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

      expect(repository.assignPermission).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if role is OWNER', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockSystemRole as any);

      await expect(
        service.assignPermission('role-system', 'perm-1', 'org-1'),
      ).rejects.toThrow(
        new BadRequestException(
          'El rol OWNER tiene permisos globales irrevocables y no puede ser modificado',
        ),
      );

      expect(repository.assignPermission).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if role is another system default', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockAdminRole as any);

      await expect(
        service.assignPermission('role-admin', 'perm-1', 'org-1'),
      ).rejects.toThrow(
        new BadRequestException(
          'No se pueden modificar los permisos de un rol del sistema',
        ),
      );

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

    // ── Auditoría y dirty flag ───────────────────────────────────────────────
    it('debería llamar a auditService.log con PERMISSION_CHANGE al asignar un permiso', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findPermissionByIdAndOrg.mockResolvedValue(mockPermission as any);
      repository.findRolePermission.mockResolvedValue(null);
      repository.assignPermission.mockResolvedValue({ id: 'rp-1' } as any);

      await service.assignPermission('role-1', 'perm-1', 'org-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PERMISSION_CHANGE,
          resourceType: 'RolePermission',
          resourceId: 'role-1',
          metadata: expect.objectContaining({ operation: 'ASSIGN', permissionId: 'perm-1' }),
        }),
      );
    });

    it('debería escribir el dirty flag en Redis al asignar un permiso', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findPermissionByIdAndOrg.mockResolvedValue(mockPermission as any);
      repository.findRolePermission.mockResolvedValue(null);
      repository.assignPermission.mockResolvedValue({ id: 'rp-1' } as any);

      await service.assignPermission('role-1', 'perm-1', 'org-1');

      expect(redisCacheService.set).toHaveBeenCalledWith(
        `${ROLE_DIRTY_PREFIX}role-1`,
        expect.any(Number),
        86400,
      );
    });

    it('NO debería llamar a auditService.log si la asignación falla (ConflictException)', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findPermissionByIdAndOrg.mockResolvedValue(mockPermission as any);
      repository.findRolePermission.mockResolvedValue({ id: 'rp-existing' } as any);

      await expect(
        service.assignPermission('role-1', 'perm-1', 'org-1'),
      ).rejects.toThrow(ConflictException);

      expect(auditService.log).not.toHaveBeenCalled();
      expect(redisCacheService.set).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // revokePermission
  // ─────────────────────────────────────────────────────────────────────────────
  describe('revokePermission', () => {
    it('should successfully delete relation if custom role and relation exists', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findRolePermission.mockResolvedValue({ id: 'rp-1' } as any);
      repository.revokePermission.mockResolvedValue(undefined as any);

      await service.revokePermission('role-1', 'perm-1', 'org-1');

      expect(repository.revokePermission).toHaveBeenCalledWith('role-1', 'perm-1');
    });

    it('should throw BadRequestException if trying to revoke from OWNER role', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockSystemRole as any);

      await expect(
        service.revokePermission('role-system', 'perm-1', 'org-1'),
      ).rejects.toThrow(
        new BadRequestException(
          'El rol OWNER tiene permisos globales irrevocables y no puede ser modificado',
        ),
      );

      expect(repository.revokePermission).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to revoke from another system default role', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockAdminRole as any);

      await expect(
        service.revokePermission('role-admin', 'perm-1', 'org-1'),
      ).rejects.toThrow(
        new BadRequestException(
          'No se pueden modificar los permisos de un rol del sistema',
        ),
      );

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

    // ── Auditoría y dirty flag ───────────────────────────────────────────────
    it('debería llamar a auditService.log con PERMISSION_CHANGE al revocar un permiso', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findRolePermission.mockResolvedValue({ id: 'rp-1' } as any);
      repository.revokePermission.mockResolvedValue(undefined as any);

      await service.revokePermission('role-1', 'perm-1', 'org-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PERMISSION_CHANGE,
          resourceType: 'RolePermission',
          resourceId: 'role-1',
          metadata: expect.objectContaining({ operation: 'REVOKE', permissionId: 'perm-1' }),
        }),
      );
    });

    it('debería escribir el dirty flag en Redis al revocar un permiso', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findRolePermission.mockResolvedValue({ id: 'rp-1' } as any);
      repository.revokePermission.mockResolvedValue(undefined as any);

      await service.revokePermission('role-1', 'perm-1', 'org-1');

      expect(redisCacheService.set).toHaveBeenCalledWith(
        `${ROLE_DIRTY_PREFIX}role-1`,
        expect.any(Number),
        86400,
      );
    });

    it('NO debería llamar a auditService.log si la revocación falla (NotFoundException)', async () => {
      repository.findRoleByIdAndOrg.mockResolvedValue(mockRole as any);
      repository.findRolePermission.mockResolvedValue(null);

      await expect(
        service.revokePermission('role-1', 'perm-not-assigned', 'org-1'),
      ).rejects.toThrow(NotFoundException);

      expect(auditService.log).not.toHaveBeenCalled();
      expect(redisCacheService.set).not.toHaveBeenCalled();
    });
  });
});
