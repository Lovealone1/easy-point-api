import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { RolesRepository } from './roles.repository.js';
import { RoleEntity } from './domain/role.entity.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';

describe('RolesService', () => {
  let service: RolesService;
  let repository: jest.Mocked<RolesRepository>;

  const mockRoleEntity = new RoleEntity({
    id: 'role-1',
    organizationId: 'org-1',
    name: 'CUSTOM_ROLE',
    description: 'A custom role',
    isSystemDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockSystemRoleEntity = new RoleEntity({
    id: 'role-system',
    organizationId: 'org-1',
    name: 'OWNER',
    description: 'System owner role',
    isSystemDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findManyWithCount: jest.fn(),
      findById: jest.fn(),
      findByNameAndOrg: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: RolesRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    repository = module.get(RolesRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a role if name is unique', async () => {
      repository.findByNameAndOrg.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockRoleEntity);

      const result = await service.create('org-1', {
        name: 'CUSTOM_ROLE',
        description: 'A custom role',
      });

      expect(repository.findByNameAndOrg).toHaveBeenCalledWith('CUSTOM_ROLE', 'org-1');
      expect(repository.create).toHaveBeenCalledWith({
        organizationId: 'org-1',
        name: 'CUSTOM_ROLE',
        description: 'A custom role',
        isSystemDefault: false,
      });
      expect(result).toEqual(mockRoleEntity);
    });

    it('should throw ConflictException if role name already exists', async () => {
      repository.findByNameAndOrg.mockResolvedValue(mockRoleEntity);

      await expect(
        service.create('org-1', {
          name: 'CUSTOM_ROLE',
        }),
      ).rejects.toThrow(ConflictException);

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return a page of roles', async () => {
      const pageOptionsDto = new PageOptionsDto();
      repository.findManyWithCount.mockResolvedValue([[mockRoleEntity], 1]);

      const result = await service.findAll('org-1', pageOptionsDto);

      expect(repository.findManyWithCount).toHaveBeenCalled();
      expect(result).toBeInstanceOf(PageDto);
      expect(result.data).toEqual([mockRoleEntity]);
      expect(result.meta.itemCount).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a role if found and organization matches', async () => {
      repository.findById.mockResolvedValue(mockRoleEntity);

      const result = await service.findOne('role-1', 'org-1');

      expect(repository.findById).toHaveBeenCalledWith('role-1');
      expect(result).toEqual(mockRoleEntity);
    });

    it('should throw NotFoundException if role not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('role-unknown', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if role belongs to another organization', async () => {
      repository.findById.mockResolvedValue(mockRoleEntity);

      await expect(service.findOne('role-1', 'org-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should successfully update a custom role', async () => {
      repository.findById.mockResolvedValue(mockRoleEntity);
      repository.findByNameAndOrg.mockResolvedValue(null);
      repository.update.mockResolvedValue({ ...mockRoleEntity, name: 'UPDATED_ROLE' } as any);

      const result = await service.update('role-1', 'org-1', { name: 'UPDATED_ROLE' });

      expect(repository.update).toHaveBeenCalledWith('role-1', { name: 'UPDATED_ROLE' });
      expect(result.name).toBe('UPDATED_ROLE');
    });

    it('should throw BadRequestException if trying to update a system default role', async () => {
      repository.findById.mockResolvedValue(mockSystemRoleEntity);

      await expect(
        service.update('role-system', 'org-1', { name: 'TRY_HACK' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if new name already exists', async () => {
      repository.findById.mockResolvedValue(mockRoleEntity);
      // Simulate another role already having the target name
      repository.findByNameAndOrg.mockResolvedValue(
        new RoleEntity({ ...mockRoleEntity, id: 'another-role', name: 'EXISTING' } as any)
      );

      await expect(
        service.update('role-1', 'org-1', { name: 'EXISTING' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should successfully delete a custom role', async () => {
      repository.findById.mockResolvedValue(mockRoleEntity);
      repository.delete.mockResolvedValue(mockRoleEntity);

      const result = await service.remove('role-1', 'org-1');

      expect(repository.delete).toHaveBeenCalledWith('role-1');
      expect(result).toEqual(mockRoleEntity);
    });

    it('should throw BadRequestException if trying to delete a system default role', async () => {
      repository.findById.mockResolvedValue(mockSystemRoleEntity);

      await expect(service.remove('role-system', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
