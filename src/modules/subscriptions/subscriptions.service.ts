import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionsRepository } from './subscriptions.repository.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto.js';
import { FindSubscriptionsDto } from './dto/find-subscriptions.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { SubscriptionEntity } from './domain/subscription.entity.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, SubscriptionStatus, BillingCycle } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsRepository: SubscriptionsRepository,
  ) {}

  async create(userId: string, createDto: CreateSubscriptionDto): Promise<SubscriptionEntity> {
    // 1. Validar que exista la organización
    const org = await this.prisma.organization.findUnique({
      where: { id: createDto.organizationId },
    });
    if (!org) {
      throw new NotFoundException(`Organization with ID ${createDto.organizationId} not found`);
    }

    // 2. Validar que exista el plan y esté activo
    const plan = await this.prisma.plan.findUnique({
      where: { id: createDto.planId },
    });
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${createDto.planId} not found`);
    }
    if (!plan.isActive) {
      throw new BadRequestException('The selected plan is inactive');
    }

    // Rule check: if plan is premium, require billing details
    const isPremium = plan.name.toLowerCase().includes('premium');
    if (isPremium) {
      const [natural, juridica] = await Promise.all([
        this.prisma.personaNaturalBilling.count({ where: { userId } }),
        this.prisma.personaJuridicaBilling.count({ where: { userId } }),
      ]);
      if (natural === 0 && juridica === 0) {
        throw new BadRequestException('Se requiere configurar la información de facturación electrónica en tu perfil (user-info) antes de adquirir o pagar un plan Premium.');
      }
    }

    // 3. Definir períodos de fechas
    const start = createDto.currentPeriodStart ? new Date(createDto.currentPeriodStart) : new Date();
    let end: Date;
    if (createDto.currentPeriodEnd) {
      end = new Date(createDto.currentPeriodEnd);
    } else {
      end = new Date(start);
      if (createDto.billingCycle === BillingCycle.MONTHLY) {
        end.setMonth(end.getMonth() + 1);
      } else {
        end.setFullYear(end.getFullYear() + 1);
      }
    }

    const isFree = plan.name.toUpperCase() === 'FREE';
    const status = createDto.status ?? (isFree ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING_PAYMENT);

    return this.subscriptionsRepository.create({
      organizationId: createDto.organizationId,
      planId: createDto.planId,
      billingCycle: createDto.billingCycle,
      status,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      trialEndsAt: createDto.trialEndsAt ? new Date(createDto.trialEndsAt) : null,
      notes: createDto.notes ?? null,
      metadata: createDto.metadata ?? null,
    });
  }

  async findAll(query: FindSubscriptionsDto): Promise<PageDto<SubscriptionEntity>> {
    const where: Prisma.SubscriptionWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.planId) {
      where.planId = query.planId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.isPaused !== undefined) {
      where.isPaused = query.isPaused;
    }

    const [items, count] = await this.subscriptionsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<SubscriptionEntity> {
    const record = await this.subscriptionsRepository.findById(id);
    if (!record) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }
    return record;
  }

  async update(id: string, updateDto: UpdateSubscriptionDto, userId?: string): Promise<SubscriptionEntity> {
    const subscription = await this.findOne(id);

    const updateData: Prisma.SubscriptionUncheckedUpdateInput = {};

    if (updateDto.planId !== undefined) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: updateDto.planId },
      });
      if (!plan) {
        throw new NotFoundException(`Plan with ID ${updateDto.planId} not found`);
      }
      if (!plan.isActive) {
        throw new BadRequestException('The selected plan is inactive');
      }

      // Rule check: if plan is premium, require billing details
      const isPremium = plan.name.toLowerCase().includes('premium');
      if (isPremium && userId) {
        const [natural, juridica] = await Promise.all([
          this.prisma.personaNaturalBilling.count({ where: { userId } }),
          this.prisma.personaJuridicaBilling.count({ where: { userId } }),
        ]);
        if (natural === 0 && juridica === 0) {
          throw new BadRequestException('Se requiere configurar la información de facturación electrónica en tu perfil (user-info) antes de adquirir o pagar un plan Premium.');
        }
      }
      updateData.planId = updateDto.planId;
    }

    if (updateDto.billingCycle !== undefined) {
      updateData.billingCycle = updateDto.billingCycle;
    }
    if (updateDto.status !== undefined) {
      updateData.status = updateDto.status;
    }
    if (updateDto.currentPeriodStart !== undefined) {
      updateData.currentPeriodStart = new Date(updateDto.currentPeriodStart);
    }
    if (updateDto.currentPeriodEnd !== undefined) {
      updateData.currentPeriodEnd = new Date(updateDto.currentPeriodEnd);
    }
    if (updateDto.trialEndsAt !== undefined) {
      updateData.trialEndsAt = updateDto.trialEndsAt ? new Date(updateDto.trialEndsAt) : null;
    }
    if (updateDto.notes !== undefined) {
      updateData.notes = updateDto.notes;
    }
    if (updateDto.metadata !== undefined) {
      updateData.metadata = updateDto.metadata;
    }

    return this.subscriptionsRepository.update(id, updateData);
  }

  async pause(id: string): Promise<SubscriptionEntity> {
    const subscription = await this.findOne(id);
    if (subscription.isPaused) {
      throw new BadRequestException('Subscription is already paused');
    }
    return this.subscriptionsRepository.update(id, {
      isPaused: true,
      pausedAt: new Date(),
    });
  }

  async resume(id: string): Promise<SubscriptionEntity> {
    const subscription = await this.findOne(id);
    if (!subscription.isPaused) {
      throw new BadRequestException('Subscription is not paused');
    }
    return this.subscriptionsRepository.update(id, {
      isPaused: false,
      pausedAt: null,
    });
  }

  async cancel(id: string): Promise<SubscriptionEntity> {
    const subscription = await this.findOne(id);
    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }
    return this.subscriptionsRepository.update(id, {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: new Date(),
    });
  }

  async remove(id: string): Promise<SubscriptionEntity> {
    const subscription = await this.findOne(id);

    // Validar si tiene invoices pagados
    const paidInvoicesCount = await this.prisma.invoice.count({
      where: {
        subscriptionId: id,
        status: 'PAID',
      },
    });

    if (paidInvoicesCount > 0) {
      throw new BadRequestException('Cannot delete subscription with paid invoices');
    }

    return this.subscriptionsRepository.delete(id);
  }
}
