import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SuppliesRepository } from './supplies.repository.js';
import { SupplyStocksService } from '../supply-stocks/supply-stocks.service.js';
import { SupplyStockEntriesRepository } from '../supply-stock-entries/supply-stock-entries.repository.js';
import { CreateSupplyDto } from './dto/create-supply.dto.js';
import { UpdateSupplyDto } from './dto/update-supply.dto.js';
import { FindSuppliesDto } from './dto/find-supplies.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { SupplyEntity } from './domain/supply.entity.js';
import { Prisma } from '@prisma/client';

/**
 * Service de Supply — capa de aplicación (orquestación).
 *
 * Responsabilidades:
 *  - Resolver el contexto de tenant (organizationId).
 *  - Coordinar el flujo entre el repositorio y la entidad de dominio.
 *  - Lanzar excepciones HTTP cuando un recurso no existe.
 *  - Construir la respuesta paginada.
 *
 * NO contiene lógica de negocio. Toda regla de dominio vive en SupplyEntity.
 */
@Injectable()
export class SuppliesService {
  constructor(
    private readonly suppliesRepository: SuppliesRepository,
    private readonly supplyStocksService: SupplyStocksService,
    private readonly supplyStockEntriesRepository: SupplyStockEntriesRepository,
  ) {}

  async create(createSupplyDto: CreateSupplyDto): Promise<SupplyEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    const createdSupply = await this.suppliesRepository.create({
      ...createSupplyDto,
      organizationId,
      basePrice: new Prisma.Decimal(createSupplyDto.basePrice),
      packageSize: new Prisma.Decimal(createSupplyDto.packageSize),
    });

    // Trigger: crear SupplyStock + SupplyStockEntry inicial vacío
    const stock = await this.supplyStocksService.create({
      supplyId: createdSupply.id,
      location: 'Principal',
      minQuantity: 0,
    });

    // Entry inicial agotado (placeholder para trazabilidad)
    // La cantidad real se cargará al registrar una compra de insumos.
    await this.supplyStockEntriesRepository.initializeForStock(
      stock.id,
      organizationId,
      createdSupply.pricePerUnit,
    );

    return createdSupply;
  }

  async findAll(query: FindSuppliesDto): Promise<PageDto<SupplyEntity>> {
    const where: Prisma.SupplyWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    // El admin global puede pasar organizationId como query param para filtrar
    if (query.organizationId) where.organizationId = query.organizationId;

    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.unitOfMeasure) where.unitOfMeasure = query.unitOfMeasure;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, count] = await this.suppliesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<SupplyEntity> {
    const supply = await this.suppliesRepository.findById(id);
    if (!supply) {
      throw new NotFoundException(`Supply with ID ${id} not found`);
    }
    return supply;
  }

  async update(id: string, updateSupplyDto: UpdateSupplyDto): Promise<SupplyEntity> {
    const currentSupply = await this.findOne(id);
    return this.suppliesRepository.update(id, updateSupplyDto, currentSupply);
  }



  async remove(id: string): Promise<SupplyEntity> {
    await this.findOne(id);
    return this.suppliesRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<SupplyEntity> {
    const currentSupply = await this.findOne(id);
    return this.suppliesRepository.update(id, { isActive }, currentSupply);
  }

  async addNote(id: string, note: string): Promise<SupplyEntity> {
    const supply = await this.findOne(id);

    // La entidad aplica la lógica de concatenación de notas
    supply.appendNote(note);

    return this.suppliesRepository.update(id, { notes: supply.notes }, supply);
  }
}
