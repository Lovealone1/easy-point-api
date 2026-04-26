import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InventoryMovementsRepository } from './inventory-movements.repository.js';
import { ProductStocksRepository } from '../product-stocks/product-stocks.repository.js';
import { CreateAdjustmentMovementDto } from './dto/create-adjustment-movement.dto.js';
import { CreateWasteMovementDto } from './dto/create-waste-movement.dto.js';
import { CreateTestsMovementDto } from './dto/create-tests-movement.dto.js';
import { CreateProductionMovementDto } from './dto/create-production-movement.dto.js';
import { FindInventoryMovementsDto } from './dto/find-inventory-movements.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { InventoryMovementEntity } from './domain/inventory-movement.entity.js';
import { Prisma, MovementType } from '@prisma/client';

@Injectable()
export class InventoryMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryMovementsRepository: InventoryMovementsRepository,
    private readonly productStocksRepository: ProductStocksRepository,
  ) {}

  async findAll(query: FindInventoryMovementsDto): Promise<PageDto<InventoryMovementEntity>> {
    const where: Prisma.InventoryMovementWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.productId) where.productId = query.productId;
    if (query.stockId) where.stockId = query.stockId;
    if (query.type) where.type = query.type;

    const [items, count] = await this.inventoryMovementsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  // Common logic for processing a movement in a transaction
  private async processMovement(
    organizationId: string,
    userId: string,
    dto: { productId: string; stockId: string; quantity: number; reason?: string },
    type: MovementType,
    mathOperation: 'ADD' | 'SUBTRACT',
  ): Promise<InventoryMovementEntity> {
    const stock = await this.productStocksRepository.findById(dto.stockId);
    
    if (!stock) {
      throw new NotFoundException(`ProductStock with ID ${dto.stockId} not found`);
    }

    if (stock.organizationId !== organizationId || stock.productId !== dto.productId) {
      throw new BadRequestException('Stock does not belong to the given organization or product');
    }

    stock.applyMovement(dto.quantity, mathOperation);

    // Using interactive transaction to save both Movement and update Stock safely
    const movementRaw = await this.prisma.$transaction(async (tx) => {
      // 1. Update Stock
      await tx.productStock.update({
        where: { id: stock.id },
        data: { quantity: stock.quantity },
      });

      // 2. Create Movement
      return tx.inventoryMovement.create({
        data: {
          organizationId,
          productId: dto.productId,
          stockId: dto.stockId,
          quantity: new Prisma.Decimal(dto.quantity),
          type,
          reason: dto.reason,
          performedByUserId: userId,
        },
      });
    });

    return InventoryMovementEntity.fromPrisma(movementRaw);
  }

  async createAdjustment(userId: string, dto: CreateAdjustmentMovementDto): Promise<InventoryMovementEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing tenant context');

    // Adjustment can be negative or positive. The mathOperation handles ADD.
    // If quantity is negative, plus(-quantity) effectively subtracts.
    return this.processMovement(organizationId, userId, dto, MovementType.ADJUSTMENT, 'ADD');
  }

  async createWaste(userId: string, dto: CreateWasteMovementDto): Promise<InventoryMovementEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing tenant context');

    return this.processMovement(organizationId, userId, dto, MovementType.WASTE, 'SUBTRACT');
  }

  async createTests(userId: string, dto: CreateTestsMovementDto): Promise<InventoryMovementEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing tenant context');

    return this.processMovement(organizationId, userId, dto, MovementType.TESTS, 'SUBTRACT');
  }

  async createProduction(userId: string, dto: CreateProductionMovementDto): Promise<InventoryMovementEntity> {
    const organizationId = getTenantId();
    if (!organizationId) throw new BadRequestException('Missing tenant context');

    return this.processMovement(organizationId, userId, dto, MovementType.PRODUCTION, 'ADD');
  }
}
