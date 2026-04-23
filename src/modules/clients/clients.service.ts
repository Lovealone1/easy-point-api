import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ClientsRepository } from './clients.repository.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { FindClientsDto } from './dto/find-clients.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { ClientType, Prisma } from '@prisma/client';
import { ClientEntity } from './domain/client.entity.js';

/**
 * Service de Client — capa de aplicación (orquestación).
 *
 * Responsabilidades:
 *  - Resolver el organizationId desde el contexto de tenant (x-organization-id).
 *  - Construir la entidad con los datos del DTO y delegar las conversiones
 *    de tipo (creditLimit → Decimal) en la entidad.
 *  - Delegar la concatenación de notas a ClientEntity.appendNote().
 *  - Coordinar el flujo entre el repositorio y la entidad.
 *  - Lanzar NotFoundException / BadRequestException cuando corresponde.
 *
 * NO contiene lógica de negocio. Las conversiones de tipo y appendNote
 * viven en ClientEntity.
 */
@Injectable()
export class ClientsService {
  constructor(private readonly clientsRepository: ClientsRepository) {}

  async create(createClientDto: CreateClientDto): Promise<ClientEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    // Construir entidad temporal para aplicar la conversión de tipo del creditLimit
    const entity = new ClientEntity({
      id: '',
      organizationId,
      name: createClientDto.name,
      taxId: createClientDto.taxId ?? null,
      email: createClientDto.email ?? null,
      phone: createClientDto.phone,
      address: createClientDto.address ?? null,
      creditLimit: new Prisma.Decimal(0), // placeholder; se aplicará abajo
      isActive: true,
      clientType: createClientDto.clientType ?? ClientType.INDIVIDUAL,
      notes: createClientDto.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // La entidad aplica la conversión a Decimal con precisión financiera
    entity.applyCreditLimitChange(createClientDto.creditLimit);

    return this.clientsRepository.create({
      organizationId: entity.organizationId,
      name: entity.name,
      taxId: entity.taxId,
      email: entity.email,
      phone: entity.phone,
      address: entity.address,
      creditLimit: entity.creditLimit,
      isActive: entity.isActive,
      clientType: entity.clientType,
      notes: entity.notes,
    });
  }

  async findAll(query: FindClientsDto): Promise<PageDto<ClientEntity>> {
    const where: Prisma.ClientWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    // El admin global puede filtrar por org
    if (query.organizationId) where.organizationId = query.organizationId;

    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, count] = await this.clientsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<ClientEntity> {
    const client = await this.clientsRepository.findById(id);
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    return client;
  }

  async update(
    id: string,
    updateClientDto: UpdateClientDto,
  ): Promise<ClientEntity> {
    const client = await this.findOne(id);

    // La entidad aplica la conversión de tipo si el campo cambia
    if (updateClientDto.creditLimit !== undefined) {
      client.applyCreditLimitChange(updateClientDto.creditLimit);
    }

    return this.clientsRepository.update(id, {
      name: updateClientDto.name,
      taxId: updateClientDto.taxId,
      email: updateClientDto.email,
      phone: updateClientDto.phone,
      address: updateClientDto.address,
      creditLimit: client.creditLimit,
      clientType: updateClientDto.clientType,
    });
  }

  async remove(id: string): Promise<ClientEntity> {
    await this.findOne(id);
    return this.clientsRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<ClientEntity> {
    await this.findOne(id);
    return this.clientsRepository.update(id, { isActive });
  }

  async addNote(id: string, note: string): Promise<ClientEntity> {
    const client = await this.findOne(id);

    // La entidad aplica la lógica de concatenación
    client.appendNote(note);

    return this.clientsRepository.update(id, { notes: client.notes });
  }
}
