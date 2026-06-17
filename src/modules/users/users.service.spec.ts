import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersRepository } from './users.repository.js';
import { UserEntity } from './domain/user.entity.js';
import { GlobalRole } from '@prisma/client';
import { Order } from '../../common/pagination/page-options.dto.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { MailService } from '../../infraestructure/mail/mail.service.js';
import appConfig from '../../common/config/config.js';
import * as argon2 from 'argon2';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;
  let redisCacheService: jest.Mocked<any>;
  let mailService: jest.Mocked<any>;

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
      findByEmail: jest.fn(),
      revokeRefreshTokens: jest.fn(),
    };

    const mockRedisCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      smembers: jest.fn(),
    };

    const mockMailService = {
      sendMail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: mockRepository,
        },
        {
          provide: RedisCacheService,
          useValue: mockRedisCacheService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: appConfig.KEY,
          useValue: {
            app: {
              env: 'development',
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(UsersRepository) as any;
    redisCacheService = module.get(RedisCacheService) as any;
    mailService = module.get(MailService) as any;
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

  describe('requestEmailOtp', () => {
    it('should throw BadRequestException if new email is same as current email', async () => {
      repository.findById.mockResolvedValue(mockUserEntity);
      await expect(
        service.requestEmailOtp('user-123', { newEmail: mockUserEntity.email }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if new email is already in use', async () => {
      repository.findById.mockResolvedValue(mockUserEntity);
      repository.findByEmail.mockResolvedValue({ id: 'another-user' } as any);
      await expect(
        service.requestEmailOtp('user-123', { newEmail: 'existing@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should generate OTP and log it in development mode', async () => {
      repository.findById.mockResolvedValue(mockUserEntity);
      repository.findByEmail.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue(undefined);

      const result = await service.requestEmailOtp('user-123', { newEmail: 'new@example.com' });
      expect(result.message).toContain('locally');
      expect(redisCacheService.set).toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmailOtp', () => {
    it('should throw BadRequestException if OTP is invalid or expired', async () => {
      repository.findById.mockResolvedValue(mockUserEntity);
      repository.findByEmail.mockResolvedValue(null);
      redisCacheService.get.mockResolvedValue(null);

      await expect(
        service.verifyEmailOtp('user-123', { newEmail: 'new@example.com', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully verify OTP and update user email', async () => {
      repository.findById.mockResolvedValue(mockUserEntity);
      repository.findByEmail.mockResolvedValue(null);
      
      const otp = '123456';
      const hash = await argon2.hash(otp);
      redisCacheService.get.mockResolvedValue(hash);
      redisCacheService.smembers.mockResolvedValue([]);
      
      repository.update.mockResolvedValue({ ...mockUserEntity, email: 'new@example.com' } as any);

      const result = await service.verifyEmailOtp('user-123', { newEmail: 'new@example.com', otp });
      expect(result.email).toBe('new@example.com');
      expect(redisCacheService.delete).toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith('user-123', { email: 'new@example.com' });
    });
  });
});
