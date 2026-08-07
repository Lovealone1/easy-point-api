import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserSubscriptionCategoriesService } from './user-subscription-categories.service.js';
import { UserSubscriptionCategoriesRepository } from './user-subscription-categories.repository.js';
import { SubscriptionCategoryEntity } from '../subscription-catalog/domain/subscription-category.entity.js';

const userId = 'user-1';

function category(overrides: Partial<ConstructorParameters<typeof SubscriptionCategoryEntity>[0]> = {}) {
  return new SubscriptionCategoryEntity({
    id: 'cat-1',
    userId,
    key: 'mascotas',
    name: 'Mascotas',
    icon: 'pets-rounded',
    color: '#8b1fc1',
    sortOrder: 500,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

const systemCategory = category({ id: 'sys-1', userId: null, key: 'entertainment', name: 'Entretenimiento' });
const otherUsersCategory = category({ id: 'other-1', userId: 'user-2' });

describe('UserSubscriptionCategoriesService', () => {
  let service: UserSubscriptionCategoriesService;
  let repository: {
    findAllVisibleTo: jest.Mock;
    findById: jest.Mock;
    findByKeyForUser: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    countSubscriptionsUsing: jest.Mock;
    reassignAndDelete: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      findAllVisibleTo: jest.fn().mockResolvedValue([systemCategory, category()]),
      findById: jest.fn().mockResolvedValue(category()),
      findByKeyForUser: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => Promise.resolve(category({ key: data.key, name: data.name }))),
      update: jest.fn().mockImplementation((_id, data) => Promise.resolve(category(data))),
      delete: jest.fn().mockResolvedValue(category()),
      countSubscriptionsUsing: jest.fn().mockResolvedValue(0),
      reassignAndDelete: jest.fn().mockResolvedValue(category()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSubscriptionCategoriesService,
        { provide: UserSubscriptionCategoriesRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(UserSubscriptionCategoriesService);
  });

  describe('findAllForUser', () => {
    it('returns system categories alongside the user\'s own', async () => {
      const result = await service.findAllForUser(userId);

      expect(repository.findAllVisibleTo).toHaveBeenCalledWith(userId);
      expect(result.map((c) => c.id)).toEqual(['sys-1', 'cat-1']);
    });
  });

  describe('assertUsableBy', () => {
    it('accepts a system category', async () => {
      repository.findById.mockResolvedValueOnce(systemCategory);
      await expect(service.assertUsableBy('sys-1', userId)).resolves.toBe(systemCategory);
    });

    it('accepts the user\'s own category', async () => {
      await expect(service.assertUsableBy('cat-1', userId)).resolves.toBeDefined();
    });

    it('hides another user\'s category behind a 404 rather than a 403', async () => {
      repository.findById.mockResolvedValueOnce(otherUsersCategory);
      // A 403 would confirm the id exists.
      await expect(service.assertUsableBy('other-1', userId)).rejects.toThrow(NotFoundException);
    });

    it('throws when the category does not exist', async () => {
      repository.findById.mockResolvedValueOnce(null);
      await expect(service.assertUsableBy('nope', userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('derives an ASCII slug from the name', async () => {
      await service.create(userId, { name: 'Mis Mascotas Ñoño' });

      const [data] = repository.create.mock.calls[0];
      expect(data.key).toBe('mis-mascotas-nono');
      expect(data.user).toEqual({ connect: { id: userId } });
    });

    it('appends a counter when the user already has that key', async () => {
      repository.findByKeyForUser.mockResolvedValueOnce(category()).mockResolvedValueOnce(null);

      await service.create(userId, { name: 'Mascotas' });

      expect(repository.create.mock.calls[0][0].key).toBe('mascotas-2');
    });

    it('only checks the user\'s own keys, so system keys can be reused', async () => {
      await service.create(userId, { name: 'Entretenimiento' });

      expect(repository.findByKeyForUser).toHaveBeenCalledWith(userId, 'entretenimiento');
      expect(repository.create.mock.calls[0][0].key).toBe('entretenimiento');
    });

    it('rejects a name with nothing sluggable in it', async () => {
      await expect(service.create(userId, { name: '🐶🐶' })).rejects.toThrow();
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('refuses to touch a system category', async () => {
      repository.findById.mockResolvedValueOnce(systemCategory);

      await expect(service.update('sys-1', userId, { name: 'Otro' })).rejects.toThrow(ForbiddenException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('regenerates the key when the name changes', async () => {
      await service.update('cat-1', userId, { name: 'Perros y gatos' });

      expect(repository.update.mock.calls[0][1]).toEqual(
        expect.objectContaining({ name: 'Perros y gatos', key: 'perros-y-gatos' }),
      );
    });

    it('leaves the key alone when the name slugs to the same value', async () => {
      await service.update('cat-1', userId, { name: '  Mascotas  ' });

      expect(repository.update.mock.calls[0][1]).not.toHaveProperty('key');
    });

    it('only writes the fields that were sent', async () => {
      await service.update('cat-1', userId, { color: '#ff0000' });

      expect(repository.update.mock.calls[0][1]).toEqual({ color: '#ff0000' });
    });
  });

  describe('remove', () => {
    it('deletes an unused category outright', async () => {
      await service.remove('cat-1', userId);

      expect(repository.delete).toHaveBeenCalledWith('cat-1');
      expect(repository.reassignAndDelete).not.toHaveBeenCalled();
    });

    it('refuses to delete a system category', async () => {
      repository.findById.mockResolvedValueOnce(systemCategory);

      await expect(service.remove('sys-1', userId)).rejects.toThrow(ForbiddenException);
    });

    it('conflicts when the category is in use and no target was given', async () => {
      repository.countSubscriptionsUsing.mockResolvedValueOnce(3);

      // Deleting silently would strip the category off three subscriptions,
      // since the FK is onDelete: SetNull.
      await expect(service.remove('cat-1', userId)).rejects.toThrow(ConflictException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('reassigns then deletes when a target is given', async () => {
      repository.countSubscriptionsUsing.mockResolvedValueOnce(3);
      repository.findById.mockResolvedValueOnce(category()).mockResolvedValueOnce(systemCategory);

      await service.remove('cat-1', userId, 'sys-1');

      expect(repository.reassignAndDelete).toHaveBeenCalledWith('cat-1', 'sys-1');
    });

    it('rejects reassigning to the category being deleted', async () => {
      repository.countSubscriptionsUsing.mockResolvedValueOnce(1);

      await expect(service.remove('cat-1', userId, 'cat-1')).rejects.toThrow();
      expect(repository.reassignAndDelete).not.toHaveBeenCalled();
    });

    it('rejects reassigning to a category the user cannot use', async () => {
      repository.countSubscriptionsUsing.mockResolvedValueOnce(1);
      repository.findById.mockResolvedValueOnce(category()).mockResolvedValueOnce(otherUsersCategory);

      await expect(service.remove('cat-1', userId, 'other-1')).rejects.toThrow(NotFoundException);
      expect(repository.reassignAndDelete).not.toHaveBeenCalled();
    });
  });
});
