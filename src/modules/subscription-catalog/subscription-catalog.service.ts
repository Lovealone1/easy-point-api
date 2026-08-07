import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SubscriptionCatalogRepository } from './subscription-catalog.repository.js';
import { CreateSubscriptionCategoryDto } from './dto/create-subscription-category.dto.js';
import { UpdateSubscriptionCategoryDto } from './dto/update-subscription-category.dto.js';
import { CreateSubscriptionProviderDto } from './dto/create-subscription-provider.dto.js';
import { UpdateSubscriptionProviderDto } from './dto/update-subscription-provider.dto.js';
import { FindSubscriptionProvidersDto } from './dto/find-subscription-providers.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { SubscriptionCategoryEntity } from './domain/subscription-category.entity.js';
import { SubscriptionProviderEntity } from './domain/subscription-provider.entity.js';
import { StorageService } from '../../infraestructure/storage/storage.service.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class SubscriptionCatalogService {
  private readonly logger = new Logger(SubscriptionCatalogService.name);

  constructor(
    private readonly catalogRepository: SubscriptionCatalogRepository,
    private readonly storageService: StorageService,
  ) {}

  // Categories

  /**
   * The public catalog is system categories only. User-authored ones are
   * private to their owner and are served by `me/subscription-categories`.
   */
  async findAllCategories(isActive?: boolean): Promise<SubscriptionCategoryEntity[]> {
    const where: Prisma.SubscriptionCategoryWhereInput = { userId: null };
    if (isActive !== undefined) where.isActive = isActive;
    return this.catalogRepository.findAllCategories(where);
  }

  async createCategory(dto: CreateSubscriptionCategoryDto): Promise<SubscriptionCategoryEntity> {
    const existing = await this.catalogRepository.findCategoryByKey(dto.key);
    if (existing) {
      throw new BadRequestException(`Category with key "${dto.key}" already exists`);
    }

    return this.catalogRepository.createCategory({
      key: dto.key,
      name: dto.name,
      icon: dto.icon ?? null,
      color: dto.color ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
  }

  async updateCategory(id: string, dto: UpdateSubscriptionCategoryDto): Promise<SubscriptionCategoryEntity> {
    const existing = await this.catalogRepository.findCategoryById(id);
    if (!existing) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    if (dto.key && dto.key !== existing.key) {
      const clash = await this.catalogRepository.findCategoryByKey(dto.key);
      if (clash) {
        throw new BadRequestException(`Category with key "${dto.key}" already exists`);
      }
    }

    const data: Prisma.SubscriptionCategoryUpdateInput = {};
    if (dto.key !== undefined) data.key = dto.key;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.catalogRepository.updateCategory(id, data);
  }

  async findOneCategory(id: string): Promise<SubscriptionCategoryEntity> {
    const record = await this.catalogRepository.findCategoryById(id);
    if (!record) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return record;
  }

  async removeCategory(id: string): Promise<SubscriptionCategoryEntity> {
    const existing = await this.catalogRepository.findCategoryById(id);
    if (!existing) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return this.catalogRepository.deleteCategory(id);
  }

  // Providers

  async findAllProviders(query: FindSubscriptionProvidersDto): Promise<PageDto<SubscriptionProviderEntity>> {
    const where: Prisma.SubscriptionProviderWhereInput = {};

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, count] = await this.catalogRepository.findManyProvidersWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(await this.resolveLogos(items), pageMetaDto);
  }

  async findOneProvider(id: string): Promise<SubscriptionProviderEntity> {
    const record = await this.catalogRepository.findProviderById(id);
    if (!record) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }
    return this.resolveLogo(record);
  }

  /**
   * An uploaded logo is stored as a bare S3 key, which the browser cannot
   * render. Sign it on the way out. Seeded logos are absolute CDN URLs and pass
   * through untouched.
   */
  private async resolveLogo(provider: SubscriptionProviderEntity): Promise<SubscriptionProviderEntity> {
    if (!provider.logoUrl || provider.logoUrl.startsWith('http')) return provider;

    try {
      provider.logoUrl = await this.storageService.getPresignedUrl(provider.logoUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not sign the logo for provider ${provider.id}: ${message}`);
    }

    return provider;
  }

  private resolveLogos(providers: SubscriptionProviderEntity[]): Promise<SubscriptionProviderEntity[]> {
    return Promise.all(providers.map((p) => this.resolveLogo(p)));
  }

  async createProvider(dto: CreateSubscriptionProviderDto): Promise<SubscriptionProviderEntity> {
    const existing = await this.catalogRepository.findProviderByKey(dto.key);
    if (existing) {
      throw new BadRequestException(`Provider with key "${dto.key}" already exists`);
    }

    const category = await this.catalogRepository.findCategoryById(dto.categoryId);
    if (!category) {
      throw new BadRequestException(`Category with ID ${dto.categoryId} not found`);
    }

    return this.catalogRepository.createProvider({
      key: dto.key,
      name: dto.name,
      category: { connect: { id: dto.categoryId } },
      logoUrl: dto.logoUrl ?? null,
      brandColor: dto.brandColor ?? null,
      websiteUrl: dto.websiteUrl ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      metadata: dto.metadata ?? null,
    });
  }

  async updateProvider(id: string, dto: UpdateSubscriptionProviderDto): Promise<SubscriptionProviderEntity> {
    await this.findOneProvider(id);

    if (dto.key) {
      const clash = await this.catalogRepository.findProviderByKey(dto.key);
      if (clash && clash.id !== id) {
        throw new BadRequestException(`Provider with key "${dto.key}" already exists`);
      }
    }

    if (dto.categoryId) {
      const category = await this.catalogRepository.findCategoryById(dto.categoryId);
      if (!category) {
        throw new BadRequestException(`Category with ID ${dto.categoryId} not found`);
      }
    }

    const data: Prisma.SubscriptionProviderUpdateInput = {};
    if (dto.key !== undefined) data.key = dto.key;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.categoryId !== undefined) data.category = { connect: { id: dto.categoryId } };
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;
    if (dto.brandColor !== undefined) data.brandColor = dto.brandColor;
    if (dto.websiteUrl !== undefined) data.websiteUrl = dto.websiteUrl;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.metadata !== undefined) data.metadata = dto.metadata;

    return this.catalogRepository.updateProvider(id, data);
  }

  async removeProvider(id: string): Promise<SubscriptionProviderEntity> {
    await this.findOneProvider(id);
    return this.catalogRepository.deleteProvider(id);
  }

  async uploadProviderLogo(id: string, file: Express.Multer.File): Promise<SubscriptionProviderEntity> {
    const provider = await this.findOneProvider(id);

    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/svg+xml') {
      throw new BadRequestException('Only PNG or SVG files are allowed');
    }

    if (provider.logoUrl && !provider.logoUrl.startsWith('http')) {
      try {
        await this.storageService.deleteFile(provider.logoUrl);
      } catch (error) {
        console.error('Failed to delete old provider logo from S3:', error);
      }
    }

    const fileExtension = file.mimetype === 'image/png' ? 'png' : 'svg';
    const timestamp = new Date().getTime();
    const fileName = `subscription-logos/${provider.key}_${timestamp}.${fileExtension}`;
    const uploadMimetype = file.mimetype === 'image/svg+xml' ? 'image/png' : file.mimetype;
    await this.storageService.uploadFile(file.buffer, fileName, uploadMimetype);

    return this.catalogRepository.updateProvider(id, { logoUrl: fileName });
  }
}
