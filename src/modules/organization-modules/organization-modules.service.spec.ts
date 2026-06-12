import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrganizationModulesService } from './organization-modules.service.js';
import { OrganizationModulesRepository } from './organization-modules.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ModuleEntity } from '../permissions/domain/module.entity.js';

describe('OrganizationModulesService', () => {
  let service: OrganizationModulesService;
  let repository: jest.Mocked<OrganizationModulesRepository>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockRepository = {
      findAssignment: jest.fn(),
      assign: jest.fn(),
      unassign: jest.fn(),
      getAssignedModules: jest.fn(),
      getOrganizationsByModule: jest.fn(),
    };

    const mockPrisma = {
      organization: {
        count: jest.fn(),
      },
      module: {
        findUnique: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationModulesService,
        {
          provide: OrganizationModulesRepository,
          useValue: mockRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<OrganizationModulesService>(OrganizationModulesService);
    repository = module.get(OrganizationModulesRepository);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assignModule', () => {
    it('should successfully assign a module if organization, module exist and not assigned', async () => {
      (prisma.organization.count as jest.Mock).mockResolvedValue(1);
      (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1' });
      repository.findAssignment.mockResolvedValue(null);
      repository.assign.mockResolvedValue({ organizationId: 'org-1', moduleId: 'mod-1' });

      const result = await service.assignModule('org-1', 'mod-1');

      expect(prisma.organization.count).toHaveBeenCalledWith({ where: { id: 'org-1' } });
      expect(prisma.module.findUnique).toHaveBeenCalledWith({ where: { id: 'mod-1' } });
      expect(repository.findAssignment).toHaveBeenCalledWith('org-1', 'mod-1');
      expect(repository.assign).toHaveBeenCalledWith('org-1', 'mod-1');
      expect(result.message).toBe('Módulo asignado exitosamente.');
      expect(result.data).toBeDefined();
    });

    it('should be idempotent and return existing assignment if already assigned', async () => {
      const existingAssignment = { organizationId: 'org-1', moduleId: 'mod-1' };
      (prisma.organization.count as jest.Mock).mockResolvedValue(1);
      (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1' });
      repository.findAssignment.mockResolvedValue(existingAssignment);

      const result = await service.assignModule('org-1', 'mod-1');

      expect(repository.assign).not.toHaveBeenCalled();
      expect(result.message).toBe('El módulo ya está asignado a la organización.');
      expect(result.data).toBe(existingAssignment);
    });

    it('should throw NotFoundException if organization does not exist', async () => {
      (prisma.organization.count as jest.Mock).mockResolvedValue(0);

      await expect(service.assignModule('unknown-org', 'mod-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.assign).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if module does not exist', async () => {
      (prisma.organization.count as jest.Mock).mockResolvedValue(1);
      (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.assignModule('org-1', 'unknown-mod')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.assign).not.toHaveBeenCalled();
    });
  });

  describe('unassignModule', () => {
    it('should successfully unassign a module if exists', async () => {
      (prisma.organization.count as jest.Mock).mockResolvedValue(1);
      (prisma.module.count as jest.Mock).mockResolvedValue(1);
      repository.findAssignment.mockResolvedValue({ organizationId: 'org-1', moduleId: 'mod-1' });
      repository.unassign.mockResolvedValue(undefined);

      await service.unassignModule('org-1', 'mod-1');

      expect(repository.unassign).toHaveBeenCalledWith('org-1', 'mod-1');
    });

    it('should throw NotFoundException if assignment does not exist', async () => {
      (prisma.organization.count as jest.Mock).mockResolvedValue(1);
      (prisma.module.count as jest.Mock).mockResolvedValue(1);
      repository.findAssignment.mockResolvedValue(null);

      await expect(service.unassignModule('org-1', 'mod-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.unassign).not.toHaveBeenCalled();
    });
  });

  describe('getModulesForOrganization', () => {
    it('should return all assigned modules if organization exists', async () => {
      const mockModules = [
        new ModuleEntity({
          id: 'mod-1',
          key: 'sales',
          name: 'Ventas',
          description: null,
          icon: null,
          sortOrder: 1,
          isActive: true,
        }),
      ];
      (prisma.organization.count as jest.Mock).mockResolvedValue(1);
      repository.getAssignedModules.mockResolvedValue(mockModules);

      const result = await service.getModulesForOrganization('org-1');

      expect(repository.getAssignedModules).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(mockModules);
    });

    it('should throw NotFoundException if organization does not exist', async () => {
      (prisma.organization.count as jest.Mock).mockResolvedValue(0);

      await expect(service.getModulesForOrganization('unknown-org')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getOrganizationsByModule', () => {
    it('should return all organizations if module exists', async () => {
      const mockOrgs = [{ id: 'org-1', name: 'Org 1' }];
      (prisma.module.count as jest.Mock).mockResolvedValue(1);
      repository.getOrganizationsByModule.mockResolvedValue(mockOrgs);

      const result = await service.getOrganizationsByModule('mod-1');

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
