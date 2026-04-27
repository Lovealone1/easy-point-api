import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BankAccountsRepository } from './bank-accounts.repository.js';
import { CreateBankAccountDto } from './dto/create-bank-account.dto.js';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto.js';
import { FindBankAccountsDto } from './dto/find-bank-accounts.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { BankAccountEntity } from './domain/bank-account.entity.js';
import { Prisma, BankAccountStatus } from '@prisma/client';

@Injectable()
export class BankAccountsService {
  constructor(private readonly bankAccountsRepository: BankAccountsRepository) {}

  async create(createBankAccountDto: CreateBankAccountDto): Promise<BankAccountEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    return this.bankAccountsRepository.create({
      ...createBankAccountDto,
      organizationId,
    });
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

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<BankAccountEntity> {
    const record = await this.bankAccountsRepository.findById(id);
    if (!record) throw new NotFoundException(`Bank account with ID ${id} not found`);
    return record;
  }

  async update(id: string, updateBankAccountDto: UpdateBankAccountDto): Promise<BankAccountEntity> {
    await this.findOne(id);
    return this.bankAccountsRepository.update(id, updateBankAccountDto);
  }

  async remove(id: string): Promise<BankAccountEntity> {
    await this.findOne(id);
    return this.bankAccountsRepository.delete(id);
  }

  async changeStatus(id: string, status: BankAccountStatus): Promise<BankAccountEntity> {
    await this.findOne(id);
    return this.bankAccountsRepository.update(id, { status });
  }
}
