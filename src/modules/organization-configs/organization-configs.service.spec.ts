import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrganizationConfigsService } from './organization-configs.service.js';
import { OrganizationConfigsRepository } from './organization-configs.repository.js';
import { StorageService } from '../../infraestructure/storage/storage.service.js';
import * as tenantContext from '../../common/context/tenant.context.js';
import { OrganizationConfigEntity } from './domain/organization-config.entity.js';
import { Theme } from '@prisma/client';

jest.mock('../../common/context/tenant.context.js');

describe('OrganizationConfigsService', () => {
  let service: OrganizationConfigsService;
  let repository: jest.Mocked<OrganizationConfigsRepository>;
  let storageService: jest.Mocked<StorageService>;

  const mockOrgId = 'org-123';
  const mockDate = new Date();

  const mockConfigEntity = new OrganizationConfigEntity({
    id: 'config-1',
    organizationId: mockOrgId,
    logoUrl: null,
    primaryColor: '#000000',
    defaultTheme: Theme.SYSTEM,
    timezone: 'UTC',
    currency: 'USD',
    language: 'es',
    dateFormat: 'DD/MM/YYYY',
    taxId: null,
    address: null,
    phone: null,
    receiptFooter: null,
    createdAt: mockDate,
    updatedAt: mockDate,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationConfigsService,
        {
          provide: OrganizationConfigsRepository,
          useValue: {
            findByOrganizationId: jest.fn(),
            upsert: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            uploadFile: jest.fn(),
            deleteFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrganizationConfigsService>(
      OrganizationConfigsService,
    );
    repository = module.get(
      OrganizationConfigsRepository,
    ) as jest.Mocked<OrganizationConfigsRepository>;
    storageService = module.get(StorageService) as jest.Mocked<StorageService>;
  });

  describe('getConfig', () => {
    it('should throw BadRequestException if tenant id is missing', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(null);

      await expect(service.getConfig()).rejects.toThrow(BadRequestException);
      await expect(service.getConfig()).rejects.toThrow(
        'Missing x-organization-id header',
      );
    });

    it('should return existing config if found', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(mockOrgId);
      repository.findByOrganizationId.mockResolvedValue(mockConfigEntity);

      const result = await service.getConfig();

      expect(repository.findByOrganizationId).toHaveBeenCalledWith(mockOrgId);
      expect(repository.upsert).not.toHaveBeenCalled();
      expect(result).toEqual(mockConfigEntity);
    });

    it('should create and return a new config if none exists', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(mockOrgId);
      repository.findByOrganizationId.mockResolvedValue(null);
      repository.upsert.mockResolvedValue(mockConfigEntity);

      const result = await service.getConfig();

      expect(repository.findByOrganizationId).toHaveBeenCalledWith(mockOrgId);
      expect(repository.upsert).toHaveBeenCalledWith(mockOrgId, {});
      expect(result).toEqual(mockConfigEntity);
    });
  });

  describe('updateConfig', () => {
    it('should throw BadRequestException if tenant id is missing', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(null);

      await expect(service.updateConfig({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call repository.upsert with correct data', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(mockOrgId);
      const updateData = { primaryColor: '#FFFFFF', timezone: 'America/Bogota' };
      repository.upsert.mockResolvedValue({
        ...mockConfigEntity,
        primaryColor: '#FFFFFF',
        timezone: 'America/Bogota',
      } as any);

      const result = await service.updateConfig(updateData);

      expect(repository.upsert).toHaveBeenCalledWith(mockOrgId, updateData);
      expect(result.primaryColor).toBe('#FFFFFF');
    });
  });

  describe('uploadLogo', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'logo.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.from('test-logo-buffer'),
      size: 1024,
    } as any;

    it('should throw BadRequestException if tenant id is missing', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(null);

      await expect(service.uploadLogo(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if no file is provided', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(mockOrgId);

      await expect(service.uploadLogo(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid mimetype', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(mockOrgId);
      repository.findByOrganizationId.mockResolvedValue(mockConfigEntity);

      const invalidFile = { ...mockFile, mimetype: 'image/jpeg' };

      await expect(service.uploadLogo(invalidFile as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(storageService.uploadFile).not.toHaveBeenCalled();
    });

    it('should delete old logo if it exists before uploading new one', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(mockOrgId);
      const existingConfigWithLogo = new OrganizationConfigEntity({
        ...mockConfigEntity,
        logoUrl: 'logos/old-logo.png',
      });
      repository.findByOrganizationId.mockResolvedValue(existingConfigWithLogo);
      storageService.deleteFile.mockResolvedValue();
      storageService.uploadFile.mockResolvedValue('logos/new-logo.png');
      repository.upsert.mockResolvedValue({
        ...mockConfigEntity,
        logoUrl: 'logos/new-logo.png',
      } as any);

      await service.uploadLogo(mockFile);

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'logos/old-logo.png',
      );
      expect(storageService.uploadFile).toHaveBeenCalled();
      expect(repository.upsert).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({ logoUrl: expect.stringContaining('logos/org_') }),
      );
    });

    it('should ignore deleteFile error if old logo deletion fails', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(mockOrgId);
      const existingConfigWithLogo = new OrganizationConfigEntity({
        ...mockConfigEntity,
        logoUrl: 'logos/old-logo.png',
      });
      repository.findByOrganizationId.mockResolvedValue(existingConfigWithLogo);
      storageService.deleteFile.mockRejectedValue(new Error('S3 error'));
      repository.upsert.mockResolvedValue(mockConfigEntity);

      // Should not throw
      await service.uploadLogo(mockFile);

      expect(storageService.deleteFile).toHaveBeenCalled();
      expect(storageService.uploadFile).toHaveBeenCalled();
      expect(repository.upsert).toHaveBeenCalled();
    });
  });

  describe('deleteLogo', () => {
    it('should throw BadRequestException if tenant id is missing', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(null);

      await expect(service.deleteLogo()).rejects.toThrow(BadRequestException);
    });

    it('should delete logo from S3 and update config if logo exists', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(mockOrgId);
      const existingConfigWithLogo = new OrganizationConfigEntity({
        ...mockConfigEntity,
        logoUrl: 'logos/old-logo.png',
      });
      repository.findByOrganizationId.mockResolvedValue(existingConfigWithLogo);
      storageService.deleteFile.mockResolvedValue();
      repository.upsert.mockResolvedValue(mockConfigEntity);

      await service.deleteLogo();

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'logos/old-logo.png',
      );
      expect(repository.upsert).toHaveBeenCalledWith(mockOrgId, {
        logoUrl: null,
      });
    });

    it('should do nothing if logo does not exist', async () => {
      jest.spyOn(tenantContext, 'getTenantId').mockReturnValue(mockOrgId);
      repository.findByOrganizationId.mockResolvedValue(mockConfigEntity); // logoUrl is null

      const result = await service.deleteLogo();

      expect(storageService.deleteFile).not.toHaveBeenCalled();
      expect(repository.upsert).not.toHaveBeenCalled();
      expect(result).toEqual(mockConfigEntity);
    });
  });
});
