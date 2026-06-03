import { Prisma, SaleStatus } from '@prisma/client';
import { SaleEntity } from './sale.entity.js';

describe('SaleEntity', () => {
  const mockDate = new Date();

  const mockRawData = {
    id: 'sale-123',
    organizationId: 'org-123',
    clientId: 'client-123',
    subtotalAmount: new Prisma.Decimal(100),
    discountAmount: new Prisma.Decimal(10),
    totalAmount: new Prisma.Decimal(90),
    transactionId: 'txn-123',
    status: SaleStatus.COMPLETED,
    notes: 'Test note',
    performedByUserId: 'user-123',
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  it('should initialize correctly with all fields', () => {
    const entity = new SaleEntity(mockRawData);

    expect(entity.id).toBe(mockRawData.id);
    expect(entity.organizationId).toBe(mockRawData.organizationId);
    expect(entity.clientId).toBe(mockRawData.clientId);
    expect(entity.subtotalAmount).toEqual(mockRawData.subtotalAmount);
    expect(entity.discountAmount).toEqual(mockRawData.discountAmount);
    expect(entity.totalAmount).toEqual(mockRawData.totalAmount);
    expect(entity.transactionId).toBe(mockRawData.transactionId);
    expect(entity.status).toBe(mockRawData.status);
    expect(entity.notes).toBe(mockRawData.notes);
    expect(entity.performedByUserId).toBe(mockRawData.performedByUserId);
    expect(entity.createdAt).toBe(mockRawData.createdAt);
    expect(entity.updatedAt).toBe(mockRawData.updatedAt);
  });

  it('should initialize correctly with null optional fields', () => {
    const nullRawData = {
      ...mockRawData,
      clientId: null,
      subtotalAmount: null,
      discountAmount: null,
      transactionId: null,
      notes: null,
      performedByUserId: null,
    };

    const entity = new SaleEntity(nullRawData);

    expect(entity.clientId).toBeNull();
    expect(entity.subtotalAmount).toBeNull();
    expect(entity.discountAmount).toBeNull();
    expect(entity.transactionId).toBeNull();
    expect(entity.notes).toBeNull();
    expect(entity.performedByUserId).toBeNull();
    expect(entity.totalAmount).toEqual(mockRawData.totalAmount); // Still required
  });

  it('should create from Prisma raw object via fromPrisma', () => {
    const entity = SaleEntity.fromPrisma(mockRawData);

    expect(entity).toBeInstanceOf(SaleEntity);
    expect(entity.id).toBe(mockRawData.id);
    expect(entity.totalAmount).toBe(90);
  });
});
