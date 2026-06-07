import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { BadRequestException } from '@nestjs/common';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { RoleEntity } from './domain/role.entity.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';

// Mock getTenantId
jest.mock('../../common/context/tenant.context.js', () => ({
  getTenantId: jest.fn(),
}));

import { getTenantId } from '../../common/context/tenant.context.js';

describe('RolesController', () => {
  let controller: RolesController;
  let service: jest.Mocked<RolesService>;

  const mockRoleEntity = new RoleEntity({
    id: 'role-1',
    organizationId: 'org-1',
    name: 'CUSTOM_ROLE',
    description: 'A custom role',
    isSystemDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: mockService,
        },
      ],
    })
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
    .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
    .compile();

    controller = module.get<RolesController>(RolesController);
    service = module.get(RolesService);

    // Default tenant for most tests
    (getTenantId as jest.Mock).mockReturnValue('org-1');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestException if organization context is missing', async () => {
    (getTenantId as jest.Mock).mockReturnValue(undefined);

    await expect(controller.findAll(new PageOptionsDto())).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('create', () => {
    it('should pass data to the service', async () => {
      const dto: CreateRoleDto = { name: 'ROLE_TEST' };
      service.create.mockResolvedValue(mockRoleEntity);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith('org-1', dto);
      expect(result).toEqual(mockRoleEntity);
    });
  });

  describe('findAll', () => {
    it('should call the service and return a page of roles', async () => {
      const options = new PageOptionsDto();
      const pageResult = { data: [mockRoleEntity], meta: {} } as any;
      service.findAll.mockResolvedValue(pageResult);

      const result = await controller.findAll(options);

      expect(service.findAll).toHaveBeenCalledWith('org-1', options);
      expect(result).toEqual(pageResult);
    });
  });

  describe('findOne', () => {
    it('should pass ID to the service', async () => {
      service.findOne.mockResolvedValue(mockRoleEntity);

      const result = await controller.findOne('role-1');

      expect(service.findOne).toHaveBeenCalledWith('role-1', 'org-1');
      expect(result).toEqual(mockRoleEntity);
    });
  });

  describe('update', () => {
    it('should pass data to the service', async () => {
      const dto: UpdateRoleDto = { name: 'UPDATED' };
      service.update.mockResolvedValue(mockRoleEntity);

      const result = await controller.update('role-1', dto);

      expect(service.update).toHaveBeenCalledWith('role-1', 'org-1', dto);
      expect(result).toEqual(mockRoleEntity);
    });
  });

  describe('remove', () => {
    it('should pass ID to the service', async () => {
      service.remove.mockResolvedValue(mockRoleEntity);

      const result = await controller.remove('role-1');

      expect(service.remove).toHaveBeenCalledWith('role-1', 'org-1');
      expect(result).toEqual(mockRoleEntity);
    });
  });
});
