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
    };

    const mockPrisma = {
      module: {
        findUnique: jest.fn(),
      },
      feature: {
        findMany: jest.fn(),
      },
      permission: {
        findMany: jest.fn(),
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
});
