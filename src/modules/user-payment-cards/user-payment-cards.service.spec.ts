import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CardBrand } from '@prisma/client';
import { UserPaymentCardsService } from './user-payment-cards.service.js';
import { UserPaymentCardsRepository } from './user-payment-cards.repository.js';
import { UserPaymentCardEntity } from './domain/user-payment-card.entity.js';

describe('UserPaymentCardsService', () => {
  let service: UserPaymentCardsService;
  let repository: jest.Mocked<UserPaymentCardsRepository>;

  const userId = 'user-1';

  const mockCard = new UserPaymentCardEntity({
    id: 'card-1',
    userId,
    label: 'Nubank',
    brand: CardBrand.MASTERCARD,
    color: '#8A05BE',
    lastFourDigits: null,
    statementDay: 15,
    paymentDueDay: null,
    isDefault: false,
    isActive: true,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const mockRepository = {
      findAllByUser: jest.fn(),
      findById: jest.fn(),
      findByIdAndUser: jest.fn(),
      findByLabelAndUser: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      clearDefaultForUser: jest.fn(),
      countOrphanedSubscriptions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPaymentCardsService,
        { provide: UserPaymentCardsRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<UserPaymentCardsService>(UserPaymentCardsService);
    repository = module.get(UserPaymentCardsRepository) as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOneForUser', () => {
    it('throws NotFoundException when the card does not belong to the user (or does not exist)', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(null);
      await expect(service.findOneForUser('card-1', userId)).rejects.toThrow(NotFoundException);
      expect(repository.findByIdAndUser).toHaveBeenCalledWith('card-1', userId);
    });

    it('returns the card when it belongs to the user', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(mockCard);
      const result = await service.findOneForUser('card-1', userId);
      expect(result).toBe(mockCard);
    });
  });

  describe('create', () => {
    it('throws BadRequestException when the label is already used by this user', async () => {
      repository.findByLabelAndUser.mockResolvedValueOnce(mockCard);

      await expect(
        service.create(userId, { label: 'Nubank', brand: CardBrand.MASTERCARD }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('creates a card with default color and isDefault=false when not provided', async () => {
      repository.findByLabelAndUser.mockResolvedValueOnce(null);
      repository.create.mockResolvedValueOnce(mockCard);

      const result = await service.create(userId, { label: 'Nubank', brand: CardBrand.MASTERCARD });

      expect(result).toBe(mockCard);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ color: '#6366F1', isDefault: false, statementDay: null }),
      );
      expect(repository.clearDefaultForUser).not.toHaveBeenCalled();
    });

    it('clears the previous default card when creating a new default one', async () => {
      repository.findByLabelAndUser.mockResolvedValueOnce(null);
      repository.create.mockResolvedValueOnce(mockCard);

      await service.create(userId, { label: 'Nubank', brand: CardBrand.MASTERCARD, isDefault: true });

      expect(repository.clearDefaultForUser).toHaveBeenCalledWith(userId);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the card does not belong to the user', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(null);
      await expect(service.update('card-1', userId, { label: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when renaming to a label used by another card', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(mockCard);
      repository.findByLabelAndUser.mockResolvedValueOnce({ ...mockCard, id: 'card-2' } as UserPaymentCardEntity);

      await expect(service.update('card-1', userId, { label: 'Rappicard' })).rejects.toThrow(BadRequestException);
    });

    it('allows renaming to the same label it already has', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(mockCard);
      repository.update.mockResolvedValueOnce(mockCard);

      await service.update('card-1', userId, { label: 'Nubank' });

      expect(repository.findByLabelAndUser).toHaveBeenCalledWith('Nubank', userId);
      expect(repository.update).toHaveBeenCalled();
    });

    it('only builds the update payload from fields actually provided', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(mockCard);
      repository.update.mockResolvedValueOnce(mockCard);

      await service.update('card-1', userId, { statementDay: 20 });

      expect(repository.update).toHaveBeenCalledWith('card-1', { statementDay: 20 });
    });
  });

  describe('setDefault', () => {
    it('clears other defaults and marks this card as default', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(mockCard);
      repository.update.mockResolvedValueOnce({ ...mockCard, isDefault: true } as UserPaymentCardEntity);

      const result = await service.setDefault('card-1', userId);

      expect(repository.clearDefaultForUser).toHaveBeenCalledWith(userId, 'card-1');
      expect(repository.update).toHaveBeenCalledWith('card-1', { isDefault: true });
      expect(result.isDefault).toBe(true);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the card does not belong to the user', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(null);
      await expect(service.remove('card-1', userId)).rejects.toThrow(NotFoundException);
    });

    it('reports how many subscriptions were orphaned by the deletion', async () => {
      repository.findByIdAndUser.mockResolvedValueOnce(mockCard);
      repository.countOrphanedSubscriptions.mockResolvedValueOnce(2);
      repository.delete.mockResolvedValueOnce(mockCard);

      const result = await service.remove('card-1', userId);

      expect(result).toEqual({ card: mockCard, orphanedSubscriptions: 2 });
    });
  });
});
