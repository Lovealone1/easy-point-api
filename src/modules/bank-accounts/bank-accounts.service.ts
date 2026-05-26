import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BankAccountsRepository } from './bank-accounts.repository.js';
import { CreateBankAccountDto } from './dto/create-bank-account.dto.js';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto.js';
import { FindBankAccountsDto } from './dto/find-bank-accounts.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { BankAccountEntity } from './domain/bank-account.entity.js';
import { Prisma, BankAccountStatus } from '@prisma/client';
import { StorageService } from '../../infraestructure/storage/storage.service.js';

@Injectable()
export class BankAccountsService {
  constructor(
    private readonly bankAccountsRepository: BankAccountsRepository,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  private getPublicUrl(fileName: string): string {
    const supabaseUrl = this.configService.get<string>('app.supabase.url') || 'https://suxzoqfxsfgllpvbliof.supabase.co';
    const bucketName = this.configService.get<string>('app.s3.bucketName') || 'easypoint-media';
    return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;
  }

  private getS3Key(qrCodeValue: string): string {
    if (!qrCodeValue) return '';
    if (qrCodeValue.startsWith('http')) {
      const bucketName = this.configService.get<string>('app.s3.bucketName') || 'easypoint-media';
      const searchString = `/public/${bucketName}/`;
      const index = qrCodeValue.indexOf(searchString);
      if (index !== -1) {
        return qrCodeValue.substring(index + searchString.length);
      }
    }
    return qrCodeValue;
  }

  private async resolveQrCode(
    account: BankAccountEntity,
  ): Promise<BankAccountEntity> {
    if (account && account.qrCode) {
      try {
        const s3Key = this.getS3Key(account.qrCode);
        account.qrCode = await this.storageService.getPresignedUrl(s3Key);
      } catch (error) {
        console.error('Failed to generate presigned URL for qrCode:', error);
      }
    }
    return account;
  }

  private async resolveQrCodes(
    accounts: BankAccountEntity[],
  ): Promise<BankAccountEntity[]> {
    return Promise.all(accounts.map((acc) => this.resolveQrCode(acc)));
  }

  async create(
    createBankAccountDto: CreateBankAccountDto,
    file?: Express.Multer.File,
  ): Promise<BankAccountEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    if (file) {
      const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Only WEBP, JPG, JPEG, or PNG files are allowed');
      }
    }

    const { file: _, ...dbPayload } = createBankAccountDto as any;

    let created = await this.bankAccountsRepository.create({
      ...dbPayload,
      organizationId,
    });

    if (file) {
      let fileExtension = 'png';
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
        fileExtension = 'jpg';
      } else if (file.mimetype === 'image/webp') {
        fileExtension = 'webp';
      }

      const timestamp = new Date().getTime();
      const fileName = `qrcodes/org_${organizationId}_bank_${created.id}_${timestamp}.${fileExtension}`;

      await this.storageService.uploadFile(file.buffer, fileName, file.mimetype);

      const publicUrl = this.getPublicUrl(fileName);
      created = await this.bankAccountsRepository.update(created.id, { qrCode: publicUrl });
    }

    return this.resolveQrCode(created);
  }

  async findAll(query: FindBankAccountsDto): Promise<PageDto<BankAccountEntity>> {
    const where: Prisma.BankAccountWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.status) where.status = query.status;

    const [items, count] = await this.bankAccountsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const resolvedItems = await this.resolveQrCodes(items);
    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(resolvedItems, pageMetaDto);
  }

  async findOne(id: string): Promise<BankAccountEntity> {
    const record = await this.bankAccountsRepository.findById(id);
    if (!record) throw new NotFoundException(`Bank account with ID ${id} not found`);
    return this.resolveQrCode(record);
  }

  async update(id: string, updateBankAccountDto: UpdateBankAccountDto): Promise<BankAccountEntity> {
    await this.findOne(id);
    const updated = await this.bankAccountsRepository.update(id, updateBankAccountDto);
    return this.resolveQrCode(updated);
  }

  async remove(id: string): Promise<BankAccountEntity> {
    // Delete file from S3 if it exists
    const rawAccount = await this.bankAccountsRepository.findById(id);
    if (rawAccount && rawAccount.qrCode) {
      try {
        const s3Key = this.getS3Key(rawAccount.qrCode);
        await this.storageService.deleteFile(s3Key);
      } catch (error) {
        console.error('Failed to delete QR code from storage during bank account removal:', error);
      }
    }

    const deleted = await this.bankAccountsRepository.delete(id);
    return this.resolveQrCode(deleted);
  }

  async changeStatus(id: string, status: BankAccountStatus): Promise<BankAccountEntity> {
    await this.findOne(id);
    const updated = await this.bankAccountsRepository.update(id, { status });
    return this.resolveQrCode(updated);
  }

  async uploadQrCode(
    id: string,
    file: Express.Multer.File,
  ): Promise<BankAccountEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Only WEBP, JPG, JPEG, PNG are allowed (no SVG)
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only WEBP, JPG, JPEG, or PNG files are allowed');
    }

    // Retrieve the raw DB record to get the original S3 key
    const rawAccount = await this.bankAccountsRepository.findById(id);
    if (!rawAccount) {
      throw new NotFoundException(`Bank account with ID ${id} not found`);
    }
    const currentQrCode = rawAccount.qrCode;

    // Delete existing QR code from S3 if it exists
    if (currentQrCode) {
      try {
        const s3Key = this.getS3Key(currentQrCode);
        await this.storageService.deleteFile(s3Key);
      } catch (error) {
        console.error('Failed to delete old QR code from S3:', error);
      }
    }

    // Upload new QR code
    let fileExtension = 'png';
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
      fileExtension = 'jpg';
    } else if (file.mimetype === 'image/webp') {
      fileExtension = 'webp';
    }

    const timestamp = new Date().getTime();
    const fileName = `qrcodes/org_${organizationId}_bank_${id}_${timestamp}.${fileExtension}`;

    await this.storageService.uploadFile(file.buffer, fileName, file.mimetype);

    // Save public URL to DB
    const publicUrl = this.getPublicUrl(fileName);
    const updated = await this.bankAccountsRepository.update(id, { qrCode: publicUrl });
    return this.resolveQrCode(updated);
  }

  async deleteQrCode(id: string): Promise<BankAccountEntity> {
    // Retrieve the raw DB record to get the original S3 key
    const rawAccount = await this.bankAccountsRepository.findById(id);
    if (!rawAccount) {
      throw new NotFoundException(`Bank account with ID ${id} not found`);
    }
    const currentQrCode = rawAccount.qrCode;

    if (currentQrCode) {
      try {
        const s3Key = this.getS3Key(currentQrCode);
        await this.storageService.deleteFile(s3Key);
      } catch (error) {
        console.error('Failed to delete QR code from S3:', error);
      }

      const updated = await this.bankAccountsRepository.update(id, { qrCode: null });
      return this.resolveQrCode(updated);
    }

    return this.resolveQrCode(rawAccount);
  }
}
