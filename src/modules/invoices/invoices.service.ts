import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoicesRepository } from './invoices.repository.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { FindInvoicesDto } from './dto/find-invoices.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { InvoiceEntity } from './domain/invoice.entity.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, InvoiceStatus } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesRepository: InvoicesRepository,
  ) {}

  async create(createDto: CreateInvoiceDto, userId?: string): Promise<InvoiceEntity> {
    // 1. Validar que exista la organización
    const org = await this.prisma.organization.findUnique({
      where: { id: createDto.organizationId },
    });
    if (!org) {
      throw new NotFoundException(`Organization with ID ${createDto.organizationId} not found`);
    }

    // 2. Validar que exista la suscripción y pertenezca a la organización
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: createDto.subscriptionId },
    });
    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${createDto.subscriptionId} not found`);
    }
    if (subscription.organizationId !== createDto.organizationId) {
      throw new BadRequestException('Subscription does not belong to the specified organization');
    }

    // Rule check: if plan is premium, require billing details
    const plan = await this.prisma.plan.findUnique({
      where: { id: subscription.planId },
    });
    const isPremium = plan?.name.toLowerCase().includes('premium');
    if (isPremium && userId) {
      const [natural, juridica] = await Promise.all([
        this.prisma.personaNaturalBilling.count({ where: { userId } }),
        this.prisma.personaJuridicaBilling.count({ where: { userId } }),
      ]);
      if (natural === 0 && juridica === 0) {
        throw new BadRequestException('Se requiere configurar la información de facturación electrónica en tu perfil (user-info) antes de adquirir o pagar un plan Premium.');
      }
    }

    // 3. Validar si la suscripción está pausada
    if (subscription.isPaused) {
      throw new BadRequestException('Cannot generate an invoice for a paused subscription');
    }

    // 4. Generar el invoiceNumber automático: INV-{YYYY}-{NNNNN}
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({
      where: {
        invoiceNumber: {
          startsWith: `INV-${year}-`,
        },
      },
    });
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(5, '0')}`;

    // Determinar estado y fecha de pago
    let status = createDto.status ?? InvoiceStatus.PENDING;
    let paidAt: Date | null = null;

    if (createDto.paidAt) {
      paidAt = new Date(createDto.paidAt);
      status = InvoiceStatus.PAID;
    } else if (status === InvoiceStatus.PAID) {
      paidAt = new Date();
    }

    return this.invoicesRepository.create({
      organizationId: createDto.organizationId,
      subscriptionId: createDto.subscriptionId,
      invoiceNumber,
      amount: new Prisma.Decimal(createDto.amount),
      currency: createDto.currency ?? 'COP',
      status,
      dueDate: new Date(createDto.dueDate),
      paidAt,
      paymentReference: createDto.paymentReference ?? null,
      paymentMethod: createDto.paymentMethod ?? null,
      paymentNotes: createDto.paymentNotes ?? null,
      billingPeriodStart: new Date(createDto.billingPeriodStart),
      billingPeriodEnd: new Date(createDto.billingPeriodEnd),
      notes: createDto.notes ?? null,
      metadata: createDto.metadata ?? null,
    });
  }

  async findAll(query: FindInvoicesDto): Promise<PageDto<InvoiceEntity>> {
    const where: Prisma.InvoiceWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.subscriptionId) {
      where.subscriptionId = query.subscriptionId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.invoiceNumber) {
      where.invoiceNumber = { contains: query.invoiceNumber, mode: 'insensitive' };
    }

    const [items, count] = await this.invoicesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<InvoiceEntity> {
    const record = await this.invoicesRepository.findById(id);
    if (!record) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return record;
  }

  async remove(id: string): Promise<InvoiceEntity> {
    const invoice = await this.findOne(id);
    await this.prisma.invoice.delete({
      where: { id },
    });
    return invoice;
  }
}
