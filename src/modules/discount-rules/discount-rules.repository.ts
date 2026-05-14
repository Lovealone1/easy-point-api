import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { DiscountRuleEntity } from './domain/discount-rule.entity.js';

@Injectable()
export class DiscountRulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.DiscountRuleUncheckedCreateInput): Promise<DiscountRuleEntity> {
    const raw = await this.prisma.discountRule.create({ data });
    return DiscountRuleEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.DiscountRuleWhereInput;
    orderBy?: Prisma.DiscountRuleOrderByWithRelationInput;
  }): Promise<[DiscountRuleEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.discountRule.findMany({ skip, take, where, orderBy }),
      this.prisma.discountRule.count({ where }),
    ]);
    return [rows.map(DiscountRuleEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<DiscountRuleEntity | null> {
    const raw = await this.prisma.discountRule.findUnique({ where: { id } });
    return raw ? DiscountRuleEntity.fromPrisma(raw) : null;
  }

  async findByCode(
    organizationId: string,
    code: string,
  ): Promise<DiscountRuleEntity | null> {
    const raw = await this.prisma.discountRule.findUnique({
      where: { organizationId_code: { organizationId, code } },
    });
    return raw ? DiscountRuleEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.DiscountRuleUncheckedUpdateInput,
  ): Promise<DiscountRuleEntity> {
    const raw = await this.prisma.discountRule.update({ where: { id }, data });
    return DiscountRuleEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<DiscountRuleEntity> {
    const raw = await this.prisma.discountRule.delete({ where: { id } });
    return DiscountRuleEntity.fromPrisma(raw);
  }
}
