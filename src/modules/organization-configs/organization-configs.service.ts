import { Injectable, BadRequestException } from '@nestjs/common';
import { OrganizationConfigsRepository } from './organization-configs.repository.js';
import { UpdateOrganizationConfigDto } from './dto/update-organization-config.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { OrganizationConfigEntity } from './domain/organization-config.entity.js';
import { StorageService } from '../../infraestructure/storage/storage.service.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class OrganizationConfigsService {
  constructor(
    private readonly configRepository: OrganizationConfigsRepository,
    private readonly storageService: StorageService,
    private readonly redisCacheService: RedisCacheService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveLogo(
    config: OrganizationConfigEntity,
  ): Promise<OrganizationConfigEntity> {
    if (config && config.logoUrl) {
      try {
        config.logoUrl = await this.storageService.getPresignedUrl(config.logoUrl);
      } catch (error) {
        console.error('Failed to generate presigned URL for logo:', error);
      }
    }
    if (config && config.logoShortUrl) {
      try {
        config.logoShortUrl = await this.storageService.getPresignedUrl(config.logoShortUrl);
      } catch (error) {
        console.error('Failed to generate presigned URL for short logo:', error);
      }
    }
    return config;
  }

  async getConfig(): Promise<OrganizationConfigEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    const cacheKey = `org_config:${organizationId}`;
    try {
      const cached = await this.redisCacheService.get<any>(cacheKey);
      if (cached) {
        if (!cached.organizationCreatedAt) {
          // Cache is stale/outdated (lacks organizationCreatedAt), delete it to force reload from DB
          await this.redisCacheService.delete(cacheKey);
        } else {
          console.log('GET CONFIG CACHED OBJECT:', cached);
          cached.createdAt = new Date(cached.createdAt);
          cached.updatedAt = new Date(cached.updatedAt);
          if (cached.planActiveUntil) {
            cached.planActiveUntil = new Date(cached.planActiveUntil);
          }
          if (cached.organizationCreatedAt) {
            cached.organizationCreatedAt = new Date(cached.organizationCreatedAt);
          }
          const entity = new OrganizationConfigEntity(cached);
          console.log('GET CONFIG CACHED ENTITY:', entity);
          return this.resolveLogo(entity);
        }
      }
    } catch (error) {
      console.error('Failed to fetch organization config cache:', error);
    }

    let config = await this.configRepository.findByOrganizationId(
      organizationId,
    );

    // If config doesn't exist, upsert an empty/default one and return
    if (!config) {
      config = await this.configRepository.upsert(organizationId, {});
    }

    console.log('GET CONFIG DB ENTITY:', config);

    try {
      await this.redisCacheService.set(cacheKey, config);
    } catch (error) {
      console.error('Failed to set organization config cache:', error);
    }

    return this.resolveLogo(config);
  }

  async updateConfig(
    dto: UpdateOrganizationConfigDto,
  ): Promise<OrganizationConfigEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    const { organizationName, organizationEmail, ...configData } = dto;

    if (organizationName !== undefined || organizationEmail !== undefined) {
      const updateData: any = {};
      if (organizationName !== undefined) updateData.name = organizationName;
      if (organizationEmail !== undefined) updateData.email = organizationEmail;

      await this.prisma.organization.update({
        where: { id: organizationId },
        data: updateData,
      });
    }

    const config = await this.configRepository.upsert(organizationId, configData);
    
    // Invalidate cache
    try {
      await this.redisCacheService.delete(`org_config:${organizationId}`);
    } catch (error) {
      console.error('Failed to delete organization config cache:', error);
    }

    return this.resolveLogo(config);
  }

  async uploadLogo(
    file: Express.Multer.File,
  ): Promise<OrganizationConfigEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validations: PNG or SVG
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/svg+xml') {
      throw new BadRequestException('Only PNG or SVG files are allowed');
    }

    const rawConfig = await this.configRepository.findByOrganizationId(organizationId);
    const currentLogoUrl = rawConfig?.logoUrl;

    // Cap at 1 logo: Delete existing logo from S3 if it exists
    if (currentLogoUrl) {
      try {
        await this.storageService.deleteFile(currentLogoUrl);
      } catch (error) {
        // Log error but continue upload to ensure state is eventually consistent
        console.error('Failed to delete old logo from S3:', error);
      }
    }

    // Upload new logo
    const fileExtension = file.mimetype === 'image/png' ? 'png' : 'svg';
    const timestamp = new Date().getTime();
    const fileName = `logos/org_${organizationId}_${timestamp}.${fileExtension}`;

    // Workaround: Supabase Storage S3 compatibility may throw "InvalidMimeType" for "image/svg+xml"
    // during upload. We upload it as "image/png" to bypass the bucket restriction, and then
    // override the ResponseContentType to "image/svg+xml" in StorageService.getPresignedUrl when retrieving.
    const uploadMimetype = file.mimetype === 'image/svg+xml' ? 'image/png' : file.mimetype;
    await this.storageService.uploadFile(file.buffer, fileName, uploadMimetype);

    // Save URL to config
    const config = await this.configRepository.upsert(organizationId, { logoUrl: fileName });
    
    // Invalidate cache
    try {
      await this.redisCacheService.delete(`org_config:${organizationId}`);
    } catch (error) {
      console.error('Failed to delete organization config cache:', error);
    }

    return this.resolveLogo(config);
  }

  async deleteLogo(): Promise<OrganizationConfigEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    const rawConfig = await this.configRepository.findByOrganizationId(organizationId);
    const currentLogoUrl = rawConfig?.logoUrl;

    if (currentLogoUrl) {
      try {
        await this.storageService.deleteFile(currentLogoUrl);
      } catch (error) {
        console.error('Failed to delete logo from S3:', error);
      }

      const config = await this.configRepository.upsert(organizationId, { logoUrl: null });
      
      // Invalidate cache
      try {
        await this.redisCacheService.delete(`org_config:${organizationId}`);
      } catch (error) {
        console.error('Failed to delete organization config cache:', error);
      }

      return this.resolveLogo(config);
    }

    let config = rawConfig;
    if (!config) {
      config = await this.configRepository.upsert(organizationId, {});
    }

    // Invalidate cache
    try {
      await this.redisCacheService.delete(`org_config:${organizationId}`);
    } catch (error) {
      console.error('Failed to delete organization config cache:', error);
    }

    return this.resolveLogo(config);
  }

  async uploadLogoShort(
    file: Express.Multer.File,
  ): Promise<OrganizationConfigEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validations: PNG or SVG
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/svg+xml') {
      throw new BadRequestException('Only PNG or SVG files are allowed');
    }

    const rawConfig = await this.configRepository.findByOrganizationId(organizationId);
    const currentLogoShortUrl = rawConfig?.logoShortUrl;

    // Cap at 1 logo: Delete existing logo from S3 if it exists
    if (currentLogoShortUrl) {
      try {
        await this.storageService.deleteFile(currentLogoShortUrl);
      } catch (error) {
        console.error('Failed to delete old short logo from S3:', error);
      }
    }

    // Upload new logo
    const fileExtension = file.mimetype === 'image/png' ? 'png' : 'svg';
    const timestamp = new Date().getTime();
    const fileName = `logos/org_${organizationId}_short_${timestamp}.${fileExtension}`;

    const uploadMimetype = file.mimetype === 'image/svg+xml' ? 'image/png' : file.mimetype;
    await this.storageService.uploadFile(file.buffer, fileName, uploadMimetype);

    // Save URL to config
    const config = await this.configRepository.upsert(organizationId, { logoShortUrl: fileName });
    
    // Invalidate cache
    try {
      await this.redisCacheService.delete(`org_config:${organizationId}`);
    } catch (error) {
      console.error('Failed to delete organization config cache:', error);
    }

    return this.resolveLogo(config);
  }

  async deleteLogoShort(): Promise<OrganizationConfigEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    const rawConfig = await this.configRepository.findByOrganizationId(organizationId);
    const currentLogoShortUrl = rawConfig?.logoShortUrl;

    if (currentLogoShortUrl) {
      try {
        await this.storageService.deleteFile(currentLogoShortUrl);
      } catch (error) {
        console.error('Failed to delete short logo from S3:', error);
      }

      const config = await this.configRepository.upsert(organizationId, { logoShortUrl: null });
      
      // Invalidate cache
      try {
        await this.redisCacheService.delete(`org_config:${organizationId}`);
      } catch (error) {
        console.error('Failed to delete organization config cache:', error);
      }

      return this.resolveLogo(config);
    }

    let config = rawConfig;
    if (!config) {
      config = await this.configRepository.upsert(organizationId, {});
    }

    // Invalidate cache
    try {
      await this.redisCacheService.delete(`org_config:${organizationId}`);
    } catch (error) {
      console.error('Failed to delete organization config cache:', error);
    }

    return this.resolveLogo(config);
  }
}
