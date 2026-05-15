import { Injectable, BadRequestException } from '@nestjs/common';
import { OrganizationConfigsRepository } from './organization-configs.repository.js';
import { UpdateOrganizationConfigDto } from './dto/update-organization-config.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { OrganizationConfigEntity } from './domain/organization-config.entity.js';
import { StorageService } from '../../infraestructure/storage/storage.service.js';

@Injectable()
export class OrganizationConfigsService {
  constructor(
    private readonly configRepository: OrganizationConfigsRepository,
    private readonly storageService: StorageService,
  ) {}

  async getConfig(): Promise<OrganizationConfigEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    let config = await this.configRepository.findByOrganizationId(
      organizationId,
    );

    // If config doesn't exist, upsert an empty/default one and return
    if (!config) {
      config = await this.configRepository.upsert(organizationId, {});
    }

    return config;
  }

  async updateConfig(
    dto: UpdateOrganizationConfigDto,
  ): Promise<OrganizationConfigEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    return this.configRepository.upsert(organizationId, dto);
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

    const currentConfig = await this.getConfig();

    // Validations: PNG or SVG
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/svg+xml') {
      throw new BadRequestException('Only PNG or SVG files are allowed');
    }

    // Cap at 1 logo: Delete existing logo from S3 if it exists
    if (currentConfig.logoUrl) {
      try {
        await this.storageService.deleteFile(currentConfig.logoUrl);
      } catch (error) {
        // Log error but continue upload to ensure state is eventually consistent
        console.error('Failed to delete old logo from S3:', error);
      }
    }

    // Upload new logo
    const fileExtension = file.mimetype === 'image/png' ? 'png' : 'svg';
    const timestamp = new Date().getTime();
    const fileName = `logos/org_${organizationId}_${timestamp}.${fileExtension}`;

    await this.storageService.uploadFile(file.buffer, fileName, file.mimetype);

    // Save URL to config
    return this.configRepository.upsert(organizationId, { logoUrl: fileName });
  }

  async deleteLogo(): Promise<OrganizationConfigEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    const currentConfig = await this.getConfig();

    if (currentConfig.logoUrl) {
      try {
        await this.storageService.deleteFile(currentConfig.logoUrl);
      } catch (error) {
        console.error('Failed to delete logo from S3:', error);
      }

      return this.configRepository.upsert(organizationId, { logoUrl: null });
    }

    return currentConfig;
  }
}
