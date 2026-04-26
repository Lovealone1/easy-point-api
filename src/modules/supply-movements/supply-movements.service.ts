import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SupplyMovementsRepository } from './supply-movements.repository.js';
import { SupplyStocksRepository } from '../supply-stocks/supply-stocks.repository.js';
import { CreateSupplyPurchaseMovementDto } from './dto/create-supply-purchase-movement.dto.js';
import { CreateSupplyProductionMovementDto } from './dto/create-supply-production-movement.dto.js';
import { FindSupplyMovementsDto } from './dto/find-supply-movements.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { SupplyMovementEntity } from './domain/supply-movement.entity.js';
import { Prisma, SupplyMovementType } from '@prisma/client';

@Injectable()
export class SupplyMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supplyMovementsRepository: SupplyMovementsRepository,
    private readonly supplyStocksRepository: SupplyStocksRepository,
  ) {}

  async findAll(query: FindSupplyMovementsDto): Promise<PageDto<SupplyMovementEntity>> {
    const where: Prisma.SupplyMovementWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.supplyId) where.supplyId = query.supplyId;
    if (query.stockId) where.stockId = query.stockId;
    if (query.type) where.type = query.type;

    const [items, count] = await this.supplyMovementsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  // Common logic for processing a supply movement in a transaction
  private async processMovement(
    organizationId: string,
    userId: string,
    dto: { supplyId: string; stockId: string; quantity: number; reason?: string },
    type: SupplyMovementType,
    mathOperation: 'ADD' | 'SUBTRACT',
  ): Promise<SupplyMovementEntity> {
    const stock = await this.supplyStocksRepository.findById(dto.stockId);
    
    if (!stock) {
      throw new NotFoundException(`SupplyStock with ID ${dto.stockId} not found`);
    }

    if (stock.organizationId !== organizationId || stock.supplyId !== dto.supplyId) {
      throw new BadRequestException('Stock does not belong to the given organization or supply');
    }

    stock.applyMovement(dto.quantity, mathOperation);

    const movementRaw = await this.prisma.$transaction(async (tx) => {
      // 1. Update Stock
      await tx.supplyStock.update({
        where: { id: stock.id },
        data: { quantity: stock.quantity },
      });

      // 2. Create Movement
      return tx.supplyMovement.create({
        data: {
          organizationId,
          supplyId: dto.supplyId,
          stockId: dto.stockId,
          quantity: new Prisma.Decimal(dto.quantity),
          type,
          reason: dto.reason,
          performedByUserId: userId,
        },
      });
    });

    return SupplyMovementEntity.fromPrisma(movementRaw);
  }

  async createPurchase(userId: string, dto: CreateSupplyPurchaseMovementDto): Promise<SupplyMovementEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing tenant context');

    // Purchase adds to stock
    return this.processMovement(organizationId, userId, dto, SupplyMovementType.PURCHASE, 'ADD');
  }

  async createProduction(userId: string, dto: CreateSupplyProductionMovementDto): Promise<SupplyMovementEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing tenant context');

    // Production consumes stock
    return this.processMovement(organizationId, userId, dto, SupplyMovementType.PRODUCTION, 'SUBTRACT');
  }
}
