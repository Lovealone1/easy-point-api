import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersRepository } from './users.repository.js';
import { UserEntity } from './domain/user.entity.js';
import { GlobalRole } from '@prisma/client';
import { Order } from '../../common/pagination/page-options.dto.js';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  const mockUserRaw = {
    id: 'user-123',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+123456789',
    isActive: true,
    globalRole: GlobalRole.USER,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserEntity = UserEntity.fromPrisma(mockUserRaw);

  beforeEach(async () => {
    const mockRepository = {
      findManyWithCount: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(UsersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated list of users', async () => {
      repository.findManyWithCount.mockResolvedValue([[mockUserEntity], 1]);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        order: Order.DESC,
        orderBy: 'createdAt',
        skip: 0,
      });

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockUserEntity.id);
      expect(result.meta.itemCount).toBe(1);
      expect(repository.findManyWithCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: {},
      });
    });

    it('should apply search filters to query options', async () => {
      repository.findManyWithCount.mockResolvedValue([[mockUserEntity], 1]);

      await service.findAll({
        page: 1,
        limit: 10,
        order: Order.ASC,
        orderBy: 'email',
        search: 'john',
        skip: 0,
      });

      expect(repository.findManyWithCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { email: 'asc' },
        where: {
          OR: [
            { email: { contains: 'john', mode: 'insensitive' } },
            { firstName: { contains: 'john', mode: 'insensitive' } },
            { lastName: { contains: 'john', mode: 'insensitive' } },
          ],
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return user entity if found', async () => {
      repository.findById.mockResolvedValue(mockUserEntity);

      const result = await service.findOne('user-123');

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUserEntity.id);
      expect(repository.findById).toHaveBeenCalledWith('user-123');
    });

    it('should throw NotFoundException if user is not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update user profile details', async () => {
      repository.findById.mockResolvedValue(mockUserEntity);
      repository.update.mockResolvedValue(
        new UserEntity({
          ...mockUserEntity,
          firstName: 'Johnny',
        }),
      );

      const result = await service.update('user-123', { firstName: 'Johnny' });

      expect(result.firstName).toBe('Johnny');
      expect(repository.update).toHaveBeenCalledWith('user-123', { firstName: 'Johnny' });
    });
  });

  describe('updateRole', () => {
    it('should update user global role', async () => {
      repository.findById.mockResolvedValue(mockUserEntity);
      repository.update.mockResolvedValue(
        new UserEntity({
          ...mockUserEntity,
          globalRole: GlobalRole.ADMIN,
        }),
      );

      const result = await service.updateRole('user-123', { globalRole: GlobalRole.ADMIN });

      expect(result.globalRole).toBe(GlobalRole.ADMIN);
      expect(repository.update).toHaveBeenCalledWith('user-123', { globalRole: GlobalRole.ADMIN });
    });
  });

  describe('remove', () => {
    it('should delete a user and return the deleted entity', async () => {
      repository.findById.mockResolvedValue(mockUserEntity);
      repository.delete.mockResolvedValue(mockUserEntity);

      const result = await service.remove('user-123');

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUserEntity.id);
      expect(repository.delete).toHaveBeenCalledWith('user-123');
    });
  });
});
