import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionCatalogService } from './subscription-catalog.service.js';
import { SubscriptionCatalogRepository } from './subscription-catalog.repository.js';
import { StorageService } from '../../infraestructure/storage/storage.service.js';
import { SubscriptionCategoryEntity } from './domain/subscription-category.entity.js';
import { SubscriptionProviderEntity } from './domain/subscription-provider.entity.js';

describe('SubscriptionCatalogService', () => {
  let service: SubscriptionCatalogService;
  let repository: jest.Mocked<SubscriptionCatalogRepository>;
  let storageService: jest.Mocked<StorageService>;

  const mockCategory = new SubscriptionCategoryEntity({
    id: 'cat-1',
    userId: null,
    key: 'entertainment',
    name: 'Entretenimiento',
    icon: 'movie-rounded',
    color: '#E50914',
    sortOrder: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockProvider = new SubscriptionProviderEntity({
    id: 'prov-1',
    key: 'netflix',
    name: 'Netflix',
    categoryId: 'cat-1',
    logoUrl: 'https://cdn.example.com/netflix.png',
    brandColor: '#E50914',
    websiteUrl: 'https://netflix.com',
    description: null,
    isActive: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const mockRepository = {
      findAllCategories: jest.fn(),
      findCategoryById: jest.fn(),
      findCategoryByKey: jest.fn(),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      findManyProvidersWithCount: jest.fn(),
      findProviderById: jest.fn(),
      findProviderByKey: jest.fn(),
      createProvider: jest.fn(),
      updateProvider: jest.fn(),
      deleteProvider: jest.fn(),
    };

    const mockStorageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionCatalogService,
        { provide: SubscriptionCatalogRepository, useValue: mockRepository },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<SubscriptionCatalogService>(SubscriptionCatalogService);
    repository = module.get(SubscriptionCatalogRepository) as any;
    storageService = module.get(StorageService) as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCategory', () => {
    it('creates a category when the key is unique', async () => {
      repository.findCategoryByKey.mockResolvedValueOnce(null);
      repository.createCategory.mockResolvedValueOnce(mockCategory);

      const result = await service.createCategory({ key: 'entertainment', name: 'Entretenimiento' });

      expect(result).toBe(mockCategory);
      expect(repository.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'entertainment', name: 'Entretenimiento', isActive: true, sortOrder: 0 }),
      );
    });

    it('throws BadRequestException when the key already exists', async () => {
      repository.findCategoryByKey.mockResolvedValueOnce(mockCategory);

      await expect(service.createCategory({ key: 'entertainment', name: 'Entretenimiento' })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.createCategory).not.toHaveBeenCalled();
    });
  });

  describe('findAllCategories', () => {
    it('passes isActive through to the repository filter when provided', async () => {
      repository.findAllCategories.mockResolvedValueOnce([mockCategory]);

      const result = await service.findAllCategories(true);

      expect(result).toEqual([mockCategory]);
      expect(repository.findAllCategories).toHaveBeenCalledWith({ userId: null, isActive: true });
    });

    it('does not filter by isActive when it is omitted', async () => {
      repository.findAllCategories.mockResolvedValueOnce([mockCategory]);

      await service.findAllCategories();

      expect(repository.findAllCategories).toHaveBeenCalledWith({ userId: null });
    });

    it('never exposes user-authored categories through the public catalog', async () => {
      repository.findAllCategories.mockResolvedValueOnce([]);

      await service.findAllCategories();

      const [where] = repository.findAllCategories.mock.calls[0];
      expect(where.userId).toBeNull();
    });
  });

  describe('findOneCategory', () => {
    it('throws NotFoundException when the category does not exist', async () => {
      repository.findCategoryById.mockResolvedValueOnce(null);
      await expect(service.findOneCategory('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the category when found', async () => {
      repository.findCategoryById.mockResolvedValueOnce(mockCategory);
      const result = await service.findOneCategory('cat-1');
      expect(result).toBe(mockCategory);
    });
  });

  describe('updateCategory', () => {
    it('throws NotFoundException when the category does not exist', async () => {
      repository.findCategoryById.mockResolvedValueOnce(null);

      await expect(service.updateCategory('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when renaming to a key already used by another category', async () => {
      repository.findCategoryById.mockResolvedValueOnce(mockCategory);
      repository.findCategoryByKey.mockResolvedValueOnce({ ...mockCategory, id: 'cat-2' } as SubscriptionCategoryEntity);

      await expect(service.updateCategory('cat-1', { key: 'music' })).rejects.toThrow(BadRequestException);
    });

    it('allows keeping the same key unchanged', async () => {
      repository.findCategoryById.mockResolvedValueOnce(mockCategory);
      repository.updateCategory.mockResolvedValueOnce(mockCategory);

      const result = await service.updateCategory('cat-1', { key: 'entertainment', name: 'Nuevo nombre' });

      expect(repository.findCategoryByKey).not.toHaveBeenCalled();
      expect(result).toBe(mockCategory);
    });
  });

  describe('removeCategory', () => {
    it('throws NotFoundException when the category does not exist', async () => {
      repository.findCategoryById.mockResolvedValueOnce(null);
      await expect(service.removeCategory('missing')).rejects.toThrow(NotFoundException);
    });

    it('deletes an existing category', async () => {
      repository.findCategoryById.mockResolvedValueOnce(mockCategory);
      repository.deleteCategory.mockResolvedValueOnce(mockCategory);

      const result = await service.removeCategory('cat-1');
      expect(result).toBe(mockCategory);
    });
  });

  describe('createProvider', () => {
    it('creates a provider when key is unique and the category exists', async () => {
      repository.findProviderByKey.mockResolvedValueOnce(null);
      repository.findCategoryById.mockResolvedValueOnce(mockCategory);
      repository.createProvider.mockResolvedValueOnce(mockProvider);

      const result = await service.createProvider({ key: 'netflix', name: 'Netflix', categoryId: 'cat-1' });

      expect(result).toBe(mockProvider);
    });

    it('throws BadRequestException when the provider key already exists', async () => {
      repository.findProviderByKey.mockResolvedValueOnce(mockProvider);

      await expect(
        service.createProvider({ key: 'netflix', name: 'Netflix', categoryId: 'cat-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the category does not exist', async () => {
      repository.findProviderByKey.mockResolvedValueOnce(null);
      repository.findCategoryById.mockResolvedValueOnce(null);

      await expect(
        service.createProvider({ key: 'netflix', name: 'Netflix', categoryId: 'missing-cat' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOneProvider', () => {
    it('throws NotFoundException when the provider does not exist', async () => {
      repository.findProviderById.mockResolvedValueOnce(null);
      await expect(service.findOneProvider('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the provider when found', async () => {
      repository.findProviderById.mockResolvedValueOnce(mockProvider);
      const result = await service.findOneProvider('prov-1');
      expect(result).toBe(mockProvider);
    });
  });

  describe('findAllProviders', () => {
    it('builds category/isActive/search filters and returns a paginated result', async () => {
      repository.findManyProvidersWithCount.mockResolvedValueOnce([[mockProvider], 1]);

      const result = await service.findAllProviders({
        categoryId: 'cat-1',
        isActive: true,
        search: 'flix',
        page: 1,
        limit: 10,
        order: 'DESC' as any,
        orderBy: 'createdAt',
        skip: 0,
      } as any);

      expect(result.data).toEqual([mockProvider]);
      expect(result.meta.itemCount).toBe(1);
      expect(repository.findManyProvidersWithCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: 'cat-1',
            isActive: true,
            OR: expect.arrayContaining([{ name: { contains: 'flix', mode: 'insensitive' } }]),
          }),
        }),
      );
    });
  });

  describe('updateProvider', () => {
    it('throws NotFoundException when the provider does not exist', async () => {
      repository.findProviderById.mockResolvedValueOnce(null);
      await expect(service.updateProvider('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when renaming to a key used by another provider', async () => {
      repository.findProviderById.mockResolvedValueOnce(mockProvider);
      repository.findProviderByKey.mockResolvedValueOnce({ ...mockProvider, id: 'prov-2' } as SubscriptionProviderEntity);

      await expect(service.updateProvider('prov-1', { key: 'spotify' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when moving to a non-existent category', async () => {
      repository.findProviderById.mockResolvedValueOnce(mockProvider);
      repository.findCategoryById.mockResolvedValueOnce(null);

      await expect(service.updateProvider('prov-1', { categoryId: 'missing-cat' })).rejects.toThrow(BadRequestException);
    });

    it('updates the provider when validations pass', async () => {
      repository.findProviderById.mockResolvedValueOnce(mockProvider);
      repository.updateProvider.mockResolvedValueOnce(mockProvider);

      const result = await service.updateProvider('prov-1', { description: 'Streaming' });

      expect(result).toBe(mockProvider);
      expect(repository.updateProvider).toHaveBeenCalledWith('prov-1', { description: 'Streaming' });
    });
  });

  describe('removeProvider', () => {
    it('throws NotFoundException when the provider does not exist', async () => {
      repository.findProviderById.mockResolvedValueOnce(null);
      await expect(service.removeProvider('missing')).rejects.toThrow(NotFoundException);
    });

    it('deletes an existing provider', async () => {
      repository.findProviderById.mockResolvedValueOnce(mockProvider);
      repository.deleteProvider.mockResolvedValueOnce(mockProvider);

      const result = await service.removeProvider('prov-1');
      expect(result).toBe(mockProvider);
    });
  });

  describe('uploadProviderLogo', () => {
    const pngFile = { mimetype: 'image/png', buffer: Buffer.from('fake') } as Express.Multer.File;

    it('throws BadRequestException when no file is provided', async () => {
      repository.findProviderById.mockResolvedValueOnce(mockProvider);
      await expect(service.uploadProviderLogo('prov-1', undefined as unknown as Express.Multer.File)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for unsupported mimetypes', async () => {
      repository.findProviderById.mockResolvedValueOnce(mockProvider);
      const badFile = { mimetype: 'image/jpeg', buffer: Buffer.from('fake') } as Express.Multer.File;

      await expect(service.uploadProviderLogo('prov-1', badFile)).rejects.toThrow(BadRequestException);
    });

    it('does not attempt to delete a logo that is an external URL (seeded CDN link)', async () => {
      repository.findProviderById.mockResolvedValueOnce(mockProvider); // logoUrl starts with https://
      repository.updateProvider.mockResolvedValueOnce(mockProvider);

      await service.uploadProviderLogo('prov-1', pngFile);

      expect(storageService.deleteFile).not.toHaveBeenCalled();
      expect(storageService.uploadFile).toHaveBeenCalledWith(pngFile.buffer, expect.stringContaining('netflix_'), 'image/png');
    });

    it('deletes the previous logo when it is an internally-stored file', async () => {
      const providerWithStoredLogo = new SubscriptionProviderEntity({
        ...mockProvider,
        logoUrl: 'subscription-logos/netflix_123.png',
      });
      repository.findProviderById.mockResolvedValueOnce(providerWithStoredLogo);
      repository.updateProvider.mockResolvedValueOnce(providerWithStoredLogo);

      await service.uploadProviderLogo('prov-1', pngFile);

      expect(storageService.deleteFile).toHaveBeenCalledWith('subscription-logos/netflix_123.png');
    });
  });
});
