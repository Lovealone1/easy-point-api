import { Prisma, DiscountType, DiscountScope, DiscountCategory } from '@prisma/client';
import { DiscountRuleEntity } from './discount-rule.entity.js';

describe('DiscountRuleEntity', () => {
  describe('canApply', () => {
    let rule: DiscountRuleEntity;

    beforeEach(() => {
      rule = new DiscountRuleEntity({
        id: '1',
        organizationId: 'org1',
        name: 'Test Rule',
        description: null,
        code: 'TEST',
        type: DiscountType.PERCENTAGE,
        value: new Prisma.Decimal(10),
        scope: DiscountScope.GLOBAL,
        clientId: null,
        category: DiscountCategory.ONE_TIME,
        startsAt: null,
        expiresAt: null,
        maxDiscountAmount: null,
        minSaleAmount: null,
        maxUsages: null,
        usageCount: 0,
        isActive: true,
        notes: null,
        createdByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should return false if inactive', () => {
      rule.isActive = false;
      expect(rule.canApply(new Prisma.Decimal(100))).toBe(false);
    });

    it('should return false if expired', () => {
      rule.expiresAt = new Date(Date.now() - 10000); // 10 seconds ago
      expect(rule.canApply(new Prisma.Decimal(100))).toBe(false);
    });

    it('should return false if not yet started', () => {
      rule.startsAt = new Date(Date.now() + 10000); // 10 seconds from now
      expect(rule.canApply(new Prisma.Decimal(100))).toBe(false);
    });

    it('should return false if max usages reached', () => {
      rule.maxUsages = 5;
      rule.usageCount = 5;
      expect(rule.canApply(new Prisma.Decimal(100))).toBe(false);
    });

    it('should return false if min sale amount not met', () => {
      rule.minSaleAmount = new Prisma.Decimal(500);
      expect(rule.canApply(new Prisma.Decimal(499))).toBe(false);
    });

    it('should return true if all conditions met', () => {
      expect(rule.canApply(new Prisma.Decimal(100))).toBe(true);
    });
  });

  describe('computeDiscountAmount', () => {
    it('should calculate percentage discount correctly', () => {
      const rule = new DiscountRuleEntity({
        // ... required fields
        id: '1', organizationId: 'org1', name: 'Test', description: null, code: 'TEST',
        scope: DiscountScope.GLOBAL, clientId: null, category: DiscountCategory.ONE_TIME,
        startsAt: null, expiresAt: null, minSaleAmount: null, maxUsages: null,
        usageCount: 0, isActive: true, notes: null, createdByUserId: null,
        createdAt: new Date(), updatedAt: new Date(),
        type: DiscountType.PERCENTAGE,
        value: new Prisma.Decimal(20), // 20%
        maxDiscountAmount: null,
      });

      const amount = rule.computeDiscountAmount(new Prisma.Decimal(100));
      expect(amount.toNumber()).toBe(20);
    });

    it('should cap percentage discount at maxDiscountAmount', () => {
      const rule = new DiscountRuleEntity({
        // ... required fields
        id: '1', organizationId: 'org1', name: 'Test', description: null, code: 'TEST',
        scope: DiscountScope.GLOBAL, clientId: null, category: DiscountCategory.ONE_TIME,
        startsAt: null, expiresAt: null, minSaleAmount: null, maxUsages: null,
        usageCount: 0, isActive: true, notes: null, createdByUserId: null,
        createdAt: new Date(), updatedAt: new Date(),
        type: DiscountType.PERCENTAGE,
        value: new Prisma.Decimal(50), // 50%
        maxDiscountAmount: new Prisma.Decimal(30), // Max $30
      });

      const amount = rule.computeDiscountAmount(new Prisma.Decimal(100));
      expect(amount.toNumber()).toBe(30);
    });

    it('should return fixed amount correctly', () => {
      const rule = new DiscountRuleEntity({
        // ... required fields
        id: '1', organizationId: 'org1', name: 'Test', description: null, code: 'TEST',
        scope: DiscountScope.GLOBAL, clientId: null, category: DiscountCategory.ONE_TIME,
        startsAt: null, expiresAt: null, minSaleAmount: null, maxUsages: null,
        usageCount: 0, isActive: true, notes: null, createdByUserId: null,
        createdAt: new Date(), updatedAt: new Date(),
        type: DiscountType.FIXED_AMOUNT,
        value: new Prisma.Decimal(15), // $15 off
        maxDiscountAmount: null,
      });

      const amount = rule.computeDiscountAmount(new Prisma.Decimal(100));
      expect(amount.toNumber()).toBe(15);
    });

    it('should not discount more than the subtotal', () => {
      const rule = new DiscountRuleEntity({
        // ... required fields
        id: '1', organizationId: 'org1', name: 'Test', description: null, code: 'TEST',
        scope: DiscountScope.GLOBAL, clientId: null, category: DiscountCategory.ONE_TIME,
        startsAt: null, expiresAt: null, minSaleAmount: null, maxUsages: null,
        usageCount: 0, isActive: true, notes: null, createdByUserId: null,
        createdAt: new Date(), updatedAt: new Date(),
        type: DiscountType.FIXED_AMOUNT,
        value: new Prisma.Decimal(150), // $150 off
        maxDiscountAmount: null,
      });

      const amount = rule.computeDiscountAmount(new Prisma.Decimal(100));
      // Subtotal is 100, discount is 150, should cap at 100
      expect(amount.toNumber()).toBe(100);
    });
  });

  describe('generateCode', () => {
    it('should generate a code correctly for percentage', () => {
      const code = DiscountRuleEntity.generateCode('Promoción Verano', 25, DiscountType.PERCENTAGE);
      // Promoción -> PROM, Verano -> VERA. -> PROMVERA25
      expect(code).toBe('PROMVERA25');
    });

    it('should generate a code correctly for fixed amount', () => {
      const code = DiscountRuleEntity.generateCode('Descuento Especial', 5000, DiscountType.FIXED_AMOUNT);
      // Descuento -> DESC, Especial -> ESPE. No suffix for fixed amount -> DESCESPE
      expect(code).toBe('DESCESPE');
    });
  });
});
