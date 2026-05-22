import { Injectable, BadRequestException } from '@nestjs/common';
import { OrganizationConfigsRepository } from './organization-configs.repository.js';
import { UpdateOrganizationConfigDto } from './dto/update-organization-config.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { OrganizationConfigEntity } from './domain/organization-config.entity.js';
import { StorageService } from '../../infraestructure/storage/storage.service.js';
import { RedisCacheService } from '../../infraestructure/redis/redis-cache.service.js';

@Injectable()
export class OrganizationConfigsService {
  constructor(
    private readonly configRepository: OrganizationConfigsRepository,
    private readonly storageService: StorageService,
    private readonly redisCacheService: RedisCacheService,
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
        cached.createdAt = new Date(cached.createdAt);
        cached.updatedAt = new Date(cached.updatedAt);
        if (cached.planActiveUntil) {
          cached.planActiveUntil = new Date(cached.planActiveUntil);
        }
        const entity = new OrganizationConfigEntity(cached);
        return this.resolveLogo(entity);
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

    const config = await this.configRepository.upsert(organizationId, dto);
    
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
}
