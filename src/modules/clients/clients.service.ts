import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientsRepository } from './clients.repository.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { FindClientsDto } from './dto/find-clients.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(private readonly clientsRepository: ClientsRepository) {}

  async create(createClientDto: CreateClientDto) {
    return this.clientsRepository.create({
      ...createClientDto,
      creditLimit: new Prisma.Decimal(createClientDto.creditLimit),
    });
  }

  async findAll(query: FindClientsDto) {
    const where: Prisma.ClientWhereInput = {};
    
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    
    if (query.name) {
      where.name = { contains: query.name, mode: 'insensitive' };
    }
    
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [items, count] = await this.clientsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string) {
    const client = await this.clientsRepository.findById(id);
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    await this.findOne(id);
    
    const updateData: any = { ...updateClientDto };
    if (updateClientDto.creditLimit !== undefined) {
      updateData.creditLimit = new Prisma.Decimal(updateClientDto.creditLimit);
    }
    
    return this.clientsRepository.update(id, updateData);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.clientsRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.clientsRepository.update(id, { isActive });
  }

  async addNote(id: string, notes: string) {
    const client = await this.findOne(id);
    const newNotes = client.notes ? `${client.notes}\n${notes}` : notes;
    return this.clientsRepository.update(id, { notes: newNotes });
  }
}
