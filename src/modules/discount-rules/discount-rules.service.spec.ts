import { Test, TestingModule } from '@nestjs/testing';
import { DiscountRulesService } from './discount-rules.service.js';
import { DiscountRulesRepository } from './discount-rules.repository.js';
import { Prisma, DiscountType, DiscountScope, DiscountCategory } from '@prisma/client';
import { DiscountRuleEntity } from './domain/discount-rule.entity.js';
import { CreateDiscountRuleDto } from './dto/create-discount-rule.dto.js';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

// Mocks
jest.mock('../../common/context/tenant.context.js', () => ({
  getTenantId: jest.fn(),
}));
const { getTenantId } = jest.requireMock('../../common/context/tenant.context.js');

const mockRepository = {
  create: jest.fn(),
  findManyWithCount: jest.fn(),
  findById: jest.fn(),
  findByCode: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('DiscountRulesService', () => {
  let service: DiscountRulesService;
  let repository: typeof mockRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscountRulesService,
        { provide: DiscountRulesRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<DiscountRulesService>(DiscountRulesService);
    repository = module.get(DiscountRulesRepository);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockOrgId = 'org-123';
    const createDto: CreateDiscountRuleDto = {
      name: 'Summer Sale',
      type: DiscountType.PERCENTAGE,
      value: 15,
      scope: DiscountScope.GLOBAL,
      category: DiscountCategory.ONE_TIME,
    };

    it('should throw BadRequestException if organizationId is missing', async () => {
      getTenantId.mockReturnValue(null);
      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if scope is CLIENT but clientId is missing', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      const invalidDto = { ...createDto, scope: DiscountScope.CLIENT };
      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if code already exists', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      repository.findByCode.mockResolvedValueOnce({ id: 'existing-id' } as DiscountRuleEntity);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should successfully create a discount rule and auto-generate code', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      repository.findByCode.mockResolvedValueOnce(null);

      const createdRule = new DiscountRuleEntity({
        id: 'rule-123',
        organizationId: mockOrgId,
        name: createDto.name,
        description: null,
        code: 'SUMM15',
        type: createDto.type,
        value: new Prisma.Decimal(createDto.value),
        scope: createDto.scope,
        clientId: null,
        category: createDto.category,
        startsAt: null,
        expiresAt: null,
        maxDiscountAmount: null,
        minSaleAmount: null,
        maxUsages: null,
        usageCount: 0,
        isActive: true,
        notes: null,
        createdByUserId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      repository.create.mockResolvedValueOnce(createdRule);

      const result = await service.create(createDto, 'user-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('rule-123');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrgId,
          name: createDto.name,
          type: createDto.type,
          createdByUserId: 'user-123',
        })
      );
    });
  });

  describe('findByCode', () => {
    const mockOrgId = 'org-123';

    it('should throw BadRequestException if organizationId is missing', async () => {
      getTenantId.mockReturnValue(null);
      await expect(service.findByCode('CODE')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if rule not found', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      repository.findByCode.mockResolvedValueOnce(null);

      await expect(service.findByCode('NON_EXISTENT')).rejects.toThrow(NotFoundException);
    });

    it('should return rule if found', async () => {
      getTenantId.mockReturnValue(mockOrgId);
      const mockRule = { id: 'rule-123', code: 'CODE123' };
      repository.findByCode.mockResolvedValueOnce(mockRule);

      const result = await service.findByCode('CODE123');

      expect(result).toEqual(mockRule);
      expect(repository.findByCode).toHaveBeenCalledWith(mockOrgId, 'CODE123');
    });
  });
});
