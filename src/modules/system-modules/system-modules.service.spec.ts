import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SystemModulesService } from './system-modules.service.js';
import { SystemModulesRepository } from './system-modules.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ModuleEntity } from '../permissions/domain/module.entity.js';
import { PermissionType } from '@prisma/client';

describe('SystemModulesService', () => {
  let service: SystemModulesService;
  let repository: jest.Mocked<SystemModulesRepository>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
      assignModules: jest.fn(),
      unassignModule: jest.fn(),
      getAssignedModules: jest.fn(),
      getOrganizationsByModule: jest.fn(),
    };

    const mockPrisma = {
      module: {
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      feature: {
        findMany: jest.fn(),
      },
      permission: {
        findMany: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemModulesService,
        {
          provide: SystemModulesRepository,
          useValue: mockRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<SystemModulesService>(SystemModulesService);
    repository = module.get(SystemModulesRepository);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      key: 'test_module',
      name: 'Test Module',
      description: 'Testing',
      icon: 'test-icon',
      sortOrder: 1,
      isActive: true,
      features: [
        {
          key: 'test_module.feat1',
          name: 'Feature 1',
          description: 'Feature 1 Desc',
          sortOrder: 1,
          permissions: [
            {
              key: 'test_module:create',
              name: 'Create permission',
              description: 'Create description',
              type: PermissionType.CRUD,
              sortOrder: 1,
            },
          ],
        },
      ],
    };

    const mockResult = new ModuleEntity({
      id: 'mod-1',
      key: 'test_module',
      name: 'Test Module',
      description: 'Testing',
      icon: 'test-icon',
      sortOrder: 1,
      isActive: true,
      features: [],
    });

    it('should successfully create a module if all keys are unique', async () => {
      (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.permission.findMany as jest.Mock).mockResolvedValue([]);
      repository.create.mockResolvedValue(mockResult);

      const result = await service.create(createDto);

      expect(prisma.module.findUnique).toHaveBeenCalledWith({
        where: { key: 'test_module' },
      });
      expect(prisma.feature.findMany).toHaveBeenCalledWith({
        where: { key: { in: ['test_module.feat1'] } },
      });
      expect(prisma.permission.findMany).toHaveBeenCalledWith({
        where: { key: { in: ['test_module:create'] } },
      });
      expect(repository.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException if module key already exists', async () => {
      (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if feature key already exists', async () => {
      (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([
        { id: 'feat-exist', key: 'test_module.feat1' },
      ]);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if permission key already exists', async () => {
      (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.permission.findMany as jest.Mock).mockResolvedValue([
        { id: 'perm-exist', key: 'test_module:create' },
      ]);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    const mockResult = new ModuleEntity({
      id: 'mod-1',
      key: 'test_module',
      name: 'Test Module',
      description: 'Testing',
      icon: 'test-icon',
      sortOrder: 1,
      isActive: true,
      features: [],
    });

    it('should successfully delete a module if it exists', async () => {
      repository.findById.mockResolvedValue(mockResult);
      repository.delete.mockResolvedValue(mockResult);

      const result = await service.delete('mod-1');

      expect(repository.findById).toHaveBeenCalledWith('mod-1');
      expect(repository.delete).toHaveBeenCalledWith('mod-1');
      expect(result).toEqual(mockResult);
    });

    it('should throw NotFoundException if module does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('unknown-id')).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('assignModulesToOrganization', () => {
    it('should successfully assign modules to organization', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org-1' });
      (prisma.module.count as jest.Mock).mockResolvedValue(2);
      repository.assignModules.mockResolvedValue(undefined);

      await service.assignModulesToOrganization('org-1', ['mod-1', 'mod-2']);

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({ where: { id: 'org-1' } });
      expect(prisma.module.count).toHaveBeenCalledWith({ where: { id: { in: ['mod-1', 'mod-2'] } } });
      expect(repository.assignModules).toHaveBeenCalledWith('org-1', ['mod-1', 'mod-2']);
    });

    it('should throw NotFoundException if organization does not exist', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.assignModulesToOrganization('unknown-org', ['mod-1'])).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.assignModules).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if a module ID does not exist', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org-1' });
      (prisma.module.count as jest.Mock).mockResolvedValue(1); // One missing

      await expect(service.assignModulesToOrganization('org-1', ['mod-1', 'invalid-mod'])).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.assignModules).not.toHaveBeenCalled();
    });
  });

  describe('unassignModuleFromOrganization', () => {
    it('should successfully unassign a module', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org-1' });
      (prisma.module.count as jest.Mock).mockResolvedValue(1);
      repository.unassignModule.mockResolvedValue(undefined);

      await service.unassignModuleFromOrganization('org-1', 'mod-1');

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({ where: { id: 'org-1' } });
      expect(prisma.module.count).toHaveBeenCalledWith({ where: { id: 'mod-1' } });
      expect(repository.unassignModule).toHaveBeenCalledWith('org-1', 'mod-1');
    });

    it('should throw NotFoundException if organization does not exist', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.unassignModuleFromOrganization('unknown-org', 'mod-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.unassignModule).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if module does not exist', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org-1' });
      (prisma.module.count as jest.Mock).mockResolvedValue(0);

      await expect(service.unassignModuleFromOrganization('org-1', 'invalid-mod')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.unassignModule).not.toHaveBeenCalled();
    });
  });

  describe('getModulesForOrganization', () => {
    it('should return all assigned modules', async () => {
      const mockAssigned = [
        new ModuleEntity({
          id: 'mod-1',
          key: 'sales',
          name: 'Ventas',
          description: null,
          icon: null,
          sortOrder: 1,
          isActive: true,
          features: [],
        }),
      ];
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org-1' });
      repository.getAssignedModules.mockResolvedValue(mockAssigned);

      const result = await service.getModulesForOrganization('org-1');

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({ where: { id: 'org-1' } });
      expect(repository.getAssignedModules).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(mockAssigned);
    });

    it('should throw NotFoundException if organization does not exist', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getModulesForOrganization('unknown-org')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getOrganizationsByModule', () => {
    it('should return all organizations for a module', async () => {
      const mockOrgs = [{ id: 'org-1', name: 'Org 1' }];
      (prisma.module.count as jest.Mock).mockResolvedValue(1);
      repository.getOrganizationsByModule.mockResolvedValue(mockOrgs);

      const result = await service.getOrganizationsByModule('mod-1');

      expect(prisma.module.count).toHaveBeenCalledWith({ where: { id: 'mod-1' } });
      expect(repository.getOrganizationsByModule).toHaveBeenCalledWith('mod-1');
      expect(result).toEqual(mockOrgs);
    });

    it('should throw NotFoundException if module does not exist', async () => {
      (prisma.module.count as jest.Mock).mockResolvedValue(0);

      await expect(service.getOrganizationsByModule('unknown-mod')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
