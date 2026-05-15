import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { OrganizationConfigEntity } from './domain/organization-config.entity.js';

@Injectable()
export class OrganizationConfigsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrganizationId(organizationId: string): Promise<OrganizationConfigEntity | null> {
    const raw = await this.prisma.organizationConfig.findUnique({
      where: { organizationId },
    });
    return raw ? OrganizationConfigEntity.fromPrisma(raw) : null;
  }

  async upsert(
    organizationId: string,
    data: Prisma.OrganizationConfigUncheckedUpdateInput,
  ): Promise<OrganizationConfigEntity> {
    const raw = await this.prisma.organizationConfig.upsert({
      where: { organizationId },
      update: data,
      create: {
        organizationId,
        logoUrl: data.logoUrl as string | null,
        primaryColor: data.primaryColor as string | null,
        defaultTheme: data.defaultTheme as any,
        timezone: data.timezone as string,
        currency: data.currency as string,
        language: data.language as string,
        dateFormat: data.dateFormat as string,
        taxId: data.taxId as string | null,
        address: data.address as string | null,
        phone: data.phone as string | null,
        receiptFooter: data.receiptFooter as string | null,
      },
    });
    return OrganizationConfigEntity.fromPrisma(raw);
  }
}
